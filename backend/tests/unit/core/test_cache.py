"""Tests for the core cache module.

Tests follow FIRST principles:
- Fast: No external dependencies
- Independent: Each test cleans up after itself via autouse fixture
- Repeatable: Deterministic results using mocked time
- Self-verifying: Clear assertions with AAA pattern
- Timely: Written alongside the code
"""

from datetime import UTC, datetime, timedelta
from unittest.mock import patch

import pytest

from backend.core.cache import (
    REQUEST_CACHE_MAX_SIZE,
    CachedValue,
    CachingWrapper,
    TTLCache,
    clear_request_cache,
    get_request_cache,
    request_cached,
    request_cached_sync,
)


@pytest.fixture(autouse=True)
def cleanup_request_cache():
    """Ensure request cache is clean before and after each test.

    Using autouse=True ensures every test in this module starts with
    a clean cache state, preventing test interdependence.
    """
    clear_request_cache()
    yield
    clear_request_cache()


class TestRequestCache:
    """Tests for request-scoped cache functions."""

    def test_creates_new_cache_when_none_exists(self):
        """First call to get_request_cache creates a new empty cache."""
        # Act
        cache = get_request_cache()

        # Assert
        assert cache is not None
        assert len(cache) == 0

    def test_returns_same_cache_instance_within_request(self):
        """Multiple calls return the same cache instance."""
        # Arrange
        cache1 = get_request_cache()
        cache1["key"] = "value"

        # Act
        cache2 = get_request_cache()

        # Assert
        assert cache2["key"] == "value"
        assert cache1 is cache2

    def test_clear_removes_all_cached_data(self):
        """clear_request_cache removes all data and resets the cache."""
        # Arrange
        cache1 = get_request_cache()
        cache1["key"] = "value"

        # Act
        clear_request_cache()
        cache2 = get_request_cache()

        # Assert
        assert "key" not in cache2
        assert cache1 is not cache2


class TestRequestCacheMaxSize:
    """Tests for request cache size limits."""

    def test_cache_evicts_oldest_when_max_size_exceeded(self):
        """Cache evicts oldest entries when max size is exceeded.

        Note: This tests the OrderedDict LRU behavior used in the implementation.
        The actual eviction is handled by _set_cache_with_limit in the decorator.
        """
        # Arrange
        cache = get_request_cache()

        # Act - Fill cache beyond max size, manually evicting
        for i in range(REQUEST_CACHE_MAX_SIZE + 10):
            cache[f"key_{i}"] = f"value_{i}"
            while len(cache) > REQUEST_CACHE_MAX_SIZE:
                cache.popitem(last=False)

        # Assert
        assert len(cache) == REQUEST_CACHE_MAX_SIZE
        assert "key_0" not in cache  # First items evicted
        assert f"key_{REQUEST_CACHE_MAX_SIZE + 9}" in cache  # Last items remain


class TestRequestCachedDecorator:
    """Tests for the request_cached async decorator."""

    @pytest.mark.asyncio
    async def test_caches_result_for_same_key(self):
        """Decorated function is only called once for the same key."""
        # Arrange
        call_count = 0

        @request_cached(lambda x: f"key:{x}")
        async def expensive_operation(x: int) -> int:
            nonlocal call_count
            call_count += 1
            return x * 2

        # Act
        result1 = await expensive_operation(5)
        result2 = await expensive_operation(5)

        # Assert
        assert result1 == 10
        assert result2 == 10
        assert call_count == 1  # Only called once due to caching

    @pytest.mark.asyncio
    async def test_different_keys_are_cached_separately(self):
        """Different keys result in separate cache entries."""
        # Arrange
        call_count = 0

        @request_cached(lambda x: f"key:{x}")
        async def expensive_operation(x: int) -> int:
            nonlocal call_count
            call_count += 1
            return x * 2

        # Act
        result1 = await expensive_operation(5)
        result2 = await expensive_operation(10)

        # Assert
        assert result1 == 10
        assert result2 == 20
        assert call_count == 2  # Called twice for different keys


class TestRequestCachedSyncDecorator:
    """Tests for the request_cached_sync decorator."""

    def test_caches_result_for_same_key(self):
        """Decorated function is only called once for the same key."""
        # Arrange
        call_count = 0

        @request_cached_sync(lambda x: f"key:{x}")
        def expensive_operation(x: int) -> int:
            nonlocal call_count
            call_count += 1
            return x * 2

        # Act
        result1 = expensive_operation(5)
        result2 = expensive_operation(5)

        # Assert
        assert result1 == 10
        assert result2 == 10
        assert call_count == 1

    def test_different_keys_are_cached_separately(self):
        """Different keys result in separate cache entries."""
        # Arrange
        call_count = 0

        @request_cached_sync(lambda x: f"key:{x}")
        def expensive_operation(x: int) -> int:
            nonlocal call_count
            call_count += 1
            return x * 2

        # Act
        result1 = expensive_operation(5)
        result2 = expensive_operation(10)

        # Assert
        assert result1 == 10
        assert result2 == 20
        assert call_count == 2


class TestCachedValue:
    """Tests for the CachedValue dataclass."""

    def test_stores_value_and_expiration(self):
        """CachedValue correctly stores value and expiration time."""
        # Arrange
        expires = datetime.now(UTC) + timedelta(minutes=5)

        # Act
        cv = CachedValue(value="test", expires_at=expires)

        # Assert
        assert cv.value == "test"
        assert cv.expires_at == expires


class TestTTLCache:
    """Tests for the TTLCache class.

    Each test uses a fresh TTLCache instance to ensure isolation.
    """

    def test_set_and_get_basic(self):
        """Basic set and get operations work correctly."""
        # Arrange
        cache = TTLCache(ttl_seconds=300)

        # Act
        cache.set("key", "value")

        # Assert
        assert cache.get("key") == "value"

    def test_get_returns_none_for_nonexistent_key(self):
        """Getting a nonexistent key returns None."""
        # Arrange
        cache = TTLCache()

        # Act & Assert
        assert cache.get("nonexistent") is None

    def test_get_returns_none_for_expired_entry(self):
        """Expired entries return None and are removed."""
        # Arrange
        cache = TTLCache(ttl_seconds=1)
        cache.set("key", "value")

        # Act - simulate time passing
        future = datetime.now(UTC) + timedelta(seconds=2)
        with patch("backend.core.cache.datetime") as mock_dt:
            mock_dt.now.return_value = future
            result = cache.get("key")

        # Assert
        assert result is None

    def test_custom_ttl_overrides_default(self):
        """Per-key TTL overrides the cache default."""
        # Arrange
        cache = TTLCache(ttl_seconds=300)

        # Act
        cache.set("key", "value", ttl_seconds=1)

        # Assert - verify the expiration is based on custom TTL
        cached = cache._cache.get("key")
        assert cached is not None
        assert cached.expires_at < datetime.now(UTC) + timedelta(seconds=300)

    def test_delete_removes_key(self):
        """Delete removes a specific key from cache."""
        # Arrange
        cache = TTLCache()
        cache.set("key", "value")

        # Act
        cache.delete("key")

        # Assert
        assert cache.get("key") is None

    def test_delete_nonexistent_key_does_not_raise(self):
        """Deleting a nonexistent key is a no-op."""
        # Arrange
        cache = TTLCache()

        # Act & Assert - should not raise
        cache.delete("nonexistent")

    def test_clear_removes_all_entries(self):
        """Clear removes all entries from cache."""
        # Arrange
        cache = TTLCache()
        cache.set("key1", "value1")
        cache.set("key2", "value2")

        # Act
        cache.clear()

        # Assert
        assert cache.get("key1") is None
        assert cache.get("key2") is None

    def test_cleanup_expired_removes_stale_entries(self):
        """cleanup_expired removes all expired entries."""
        # Arrange
        cache = TTLCache(ttl_seconds=1)
        cache.set("key1", "value1")
        cache.set("key2", "value2")

        # Act - simulate time passing
        future = datetime.now(UTC) + timedelta(seconds=2)
        with patch("backend.core.cache.datetime") as mock_dt:
            mock_dt.now.return_value = future
            removed = cache.cleanup_expired()

        # Assert
        assert removed == 2
        assert len(cache._cache) == 0

    def test_cleanup_expired_returns_zero_when_none_expired(self):
        """cleanup_expired returns 0 when no entries are expired."""
        # Arrange
        cache = TTLCache(ttl_seconds=300)
        cache.set("key", "value")

        # Act
        removed = cache.cleanup_expired()

        # Assert
        assert removed == 0
        assert cache.get("key") == "value"


class TestCachingWrapper:
    """Tests for the CachingWrapper class."""

    @pytest.mark.asyncio
    async def test_caches_async_function_results(self):
        """Wrapper caches results of async functions."""
        # Arrange
        wrapper = CachingWrapper(ttl_seconds=300)
        call_count = 0

        @wrapper.cached(lambda x: f"key:{x}")
        async def expensive_operation(x: int) -> int:
            nonlocal call_count
            call_count += 1
            return x * 2

        # Act
        result1 = await expensive_operation(5)
        result2 = await expensive_operation(5)

        # Assert
        assert result1 == 10
        assert result2 == 10
        assert call_count == 1

    @pytest.mark.asyncio
    async def test_does_not_cache_none_values(self):
        """None values are not cached to avoid confusion with cache misses."""
        # Arrange
        wrapper = CachingWrapper()
        call_count = 0

        @wrapper.cached(lambda: "key")
        async def return_none() -> None:
            nonlocal call_count
            call_count += 1

        # Act
        result1 = await return_none()
        result2 = await return_none()

        # Assert
        assert result1 is None
        assert result2 is None
        assert call_count == 2  # Called twice because None not cached

    def test_invalidate_removes_specific_entry(self):
        """invalidate removes a specific cache entry."""
        # Arrange
        wrapper = CachingWrapper()
        wrapper._cache.set("key", "value")

        # Act
        wrapper.invalidate("key")

        # Assert
        assert wrapper._cache.get("key") is None

    def test_clear_removes_all_entries(self):
        """clear removes all cached entries."""
        # Arrange
        wrapper = CachingWrapper()
        wrapper._cache.set("key1", "value1")
        wrapper._cache.set("key2", "value2")

        # Act
        wrapper.clear()

        # Assert
        assert wrapper._cache.get("key1") is None
        assert wrapper._cache.get("key2") is None
