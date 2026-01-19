from collections.abc import AsyncGenerator

from langchain_core.messages import AIMessage, HumanMessage
from langgraph.checkpoint.memory import MemorySaver
from langgraph.prebuilt import create_react_agent

from backend.agents.llm import get_chat_model
from backend.agents.tools import get_available_tools
from backend.core.config import settings
from backend.core.logging import get_logger

logger = get_logger(__name__)


def create_react_agent_with_tools(checkpointer: MemorySaver | None = None):
    """Create a ReAct agent with tools using LangGraph's prebuilt factory.

    This is the recommended approach for agents that need tool support.
    The create_react_agent function handles:
    - Tool binding to the LLM
    - ToolNode for executing tools
    - ReAct loop logic (LLM -> tools -> LLM)
    - Proper state management

    Args:
        checkpointer: Optional checkpointer for conversation persistence

    Returns:
        Compiled agent graph
    """
    llm = get_chat_model(settings.DEFAULT_LLM_PROVIDER)
    tools = get_available_tools()

    agent = create_react_agent(
        model=llm,
        tools=tools,
        state_modifier="You are a helpful AI assistant. Use tools when appropriate.",
        checkpointer=checkpointer,
    )

    logger.info(
        "react_agent_created",
        provider=settings.DEFAULT_LLM_PROVIDER,
        tools=[t.name for t in tools],
    )

    return agent


_react_agent = None
_react_checkpointer = MemorySaver()


def get_react_agent():
    global _react_agent
    if _react_agent is None:
        _react_agent = create_react_agent_with_tools(checkpointer=_react_checkpointer)
    return _react_agent


def get_thread_config(thread_id: str) -> dict:
    return {"configurable": {"thread_id": thread_id}}


async def run_react_agent(
    message: str,
    thread_id: str | None = None,
    user_id: str | None = None,
    org_id: str | None = None,
    team_id: str | None = None,
) -> str:
    """Run the ReAct agent with tool support.

    Args:
        message: User message to process
        thread_id: Optional thread ID for conversation persistence
        user_id: Optional user ID (kept for API compatibility)
        org_id: Optional organization ID (kept for API compatibility)
        team_id: Optional team ID (kept for API compatibility)

    Returns:
        Agent response as a string
    """
    agent = get_react_agent()

    config = {"configurable": {"thread_id": thread_id}} if thread_id else {}

    logger.info(
        "running_react_agent",
        thread_id=thread_id,
    )

    result = await agent.ainvoke(
        {"messages": [HumanMessage(content=message)]},
        config=config if config else None,
    )

    for msg in reversed(result["messages"]):
        if isinstance(msg, AIMessage):
            return str(msg.content)

    return ""


async def stream_react_agent(
    message: str,
    thread_id: str | None = None,
    user_id: str | None = None,
    org_id: str | None = None,
    team_id: str | None = None,
) -> AsyncGenerator[dict, None]:
    """Stream the ReAct agent response with tool visibility.

    Yields events for both tokens and tool calls, allowing the frontend
    to show intermediate steps.

    Args:
        message: User message to process
        thread_id: Optional thread ID for conversation persistence
        user_id: Optional user ID (kept for API compatibility)
        org_id: Optional organization ID (kept for API compatibility)
        team_id: Optional team ID (kept for API compatibility)

    Yields:
        Event dicts with 'type' and 'data' keys
    """
    agent = get_react_agent()

    config = {"configurable": {"thread_id": thread_id}} if thread_id else {}

    logger.info(
        "streaming_react_agent",
        thread_id=thread_id,
    )

    async for event in agent.astream_events(
        {"messages": [HumanMessage(content=message)]},
        config=config if config else None,
        version="v2",
    ):
        event_type = event.get("event", "")

        if event_type == "on_chat_model_stream":
            chunk = event["data"].get("chunk")
            if chunk and chunk.content:
                yield {"type": "token", "data": str(chunk.content)}

        elif event_type == "on_tool_start":
            yield {
                "type": "tool_start",
                "data": {
                    "tool": event["name"],
                    "input": event["data"].get("input"),
                },
            }

        elif event_type == "on_tool_end":
            yield {
                "type": "tool_end",
                "data": {
                    "tool": event["name"],
                    "output": str(event["data"].get("output")),
                },
            }
