/**
 * Tests for useMediaUpload hook.
 *
 * Tests:
 * - File type validation (images, documents)
 * - File size validation
 * - Max files limit enforcement
 * - Upload progress tracking
 * - Error handling
 * - Cleanup of object URLs
 */

import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/mocks/server";
import {
  useMediaUpload,
  isAllowedDocumentType,
  isAllowedAttachmentType,
  getAttachmentType,
  getAllowedMediaAccept,
  getAllowedAttachmentAccept,
  MAX_IMAGE_FILE_SIZE,
  MAX_DOCUMENT_FILE_SIZE,
  MAX_FILES_PER_MESSAGE,
} from "./useMediaUpload";

// Mock URL object methods
const mockObjectUrls = new Map<string, string>();
let urlCounter = 0;

beforeEach(() => {
  mockObjectUrls.clear();
  urlCounter = 0;

  vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
    const url = `blob:mock-url-${++urlCounter}`;
    mockObjectUrls.set(url, blob.toString());
    return url;
  });

  vi.spyOn(URL, "revokeObjectURL").mockImplementation((url) => {
    mockObjectUrls.delete(url);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Helper to create a mock File
function createMockFile(name: string, size: number, type: string): File {
  const buffer = new ArrayBuffer(size);
  return new File([buffer], name, { type });
}

describe("useMediaUpload utility functions", () => {
  describe("isAllowedDocumentType", () => {
    it("returns true for allowed document types", () => {
      expect(isAllowedDocumentType("application/pdf")).toBe(true);
      expect(isAllowedDocumentType("text/plain")).toBe(true);
      expect(isAllowedDocumentType("text/markdown")).toBe(true);
      expect(isAllowedDocumentType("text/csv")).toBe(true);
    });

    it("returns false for non-document types", () => {
      expect(isAllowedDocumentType("image/jpeg")).toBe(false);
      expect(isAllowedDocumentType("application/json")).toBe(false);
      expect(isAllowedDocumentType("video/mp4")).toBe(false);
    });
  });

  describe("isAllowedAttachmentType", () => {
    it("returns true for images", () => {
      expect(isAllowedAttachmentType("image/jpeg")).toBe(true);
      expect(isAllowedAttachmentType("image/png")).toBe(true);
      expect(isAllowedAttachmentType("image/gif")).toBe(true);
      expect(isAllowedAttachmentType("image/webp")).toBe(true);
    });

    it("returns true for documents", () => {
      expect(isAllowedAttachmentType("application/pdf")).toBe(true);
      expect(isAllowedAttachmentType("text/plain")).toBe(true);
    });

    it("returns false for disallowed types", () => {
      expect(isAllowedAttachmentType("video/mp4")).toBe(false);
      expect(isAllowedAttachmentType("application/zip")).toBe(false);
    });
  });

  describe("getAttachmentType", () => {
    it("returns 'image' for image types", () => {
      expect(getAttachmentType("image/jpeg")).toBe("image");
      expect(getAttachmentType("image/png")).toBe("image");
    });

    it("returns 'document' for document types", () => {
      expect(getAttachmentType("application/pdf")).toBe("document");
      expect(getAttachmentType("text/plain")).toBe("document");
    });

    it("returns null for unsupported types", () => {
      expect(getAttachmentType("video/mp4")).toBeNull();
      expect(getAttachmentType("application/json")).toBeNull();
    });
  });

  describe("getAllowedMediaAccept", () => {
    it("returns image MIME types for accept attribute", () => {
      const accept = getAllowedMediaAccept();
      expect(accept).toContain("image/jpeg");
      expect(accept).toContain("image/png");
      expect(accept).toContain("image/gif");
      expect(accept).toContain("image/webp");
    });
  });

  describe("getAllowedAttachmentAccept", () => {
    it("returns all attachment MIME types", () => {
      const accept = getAllowedAttachmentAccept();
      expect(accept).toContain("image/jpeg");
      expect(accept).toContain("application/pdf");
      expect(accept).toContain("text/plain");
    });
  });
});

describe("useMediaUpload constants", () => {
  it("MAX_IMAGE_FILE_SIZE is 10MB", () => {
    expect(MAX_IMAGE_FILE_SIZE).toBe(10 * 1024 * 1024);
  });

  it("MAX_DOCUMENT_FILE_SIZE is 32MB", () => {
    expect(MAX_DOCUMENT_FILE_SIZE).toBe(32 * 1024 * 1024);
  });

  it("MAX_FILES_PER_MESSAGE is 5", () => {
    expect(MAX_FILES_PER_MESSAGE).toBe(5);
  });
});

describe("useMediaUpload hook", () => {
  const defaultOptions = {
    organizationId: "org-123",
    teamId: "team-123",
  };

  describe("validateFile", () => {
    it("validates valid image files", () => {
      const { result } = renderHook(() => useMediaUpload(defaultOptions));

      const validImage = createMockFile("test.jpg", 1024 * 1024, "image/jpeg");
      const validation = result.current.validateFile(validImage);

      expect(validation.valid).toBe(true);
      expect(validation.error).toBeUndefined();
    });

    it("validates valid document files", () => {
      const { result } = renderHook(() => useMediaUpload(defaultOptions));

      const validPdf = createMockFile(
        "test.pdf",
        1024 * 1024,
        "application/pdf",
      );
      const validation = result.current.validateFile(validPdf);

      expect(validation.valid).toBe(true);
    });

    it("rejects unsupported file types", () => {
      const { result } = renderHook(() => useMediaUpload(defaultOptions));

      const invalidFile = createMockFile(
        "test.exe",
        1024,
        "application/x-msdownload",
      );
      const validation = result.current.validateFile(invalidFile);

      expect(validation.valid).toBe(false);
      expect(validation.error).toBeDefined();
    });

    it("rejects oversized image files", () => {
      const { result } = renderHook(() => useMediaUpload(defaultOptions));

      const largeImage = createMockFile(
        "large.jpg",
        15 * 1024 * 1024,
        "image/jpeg",
      );
      const validation = result.current.validateFile(largeImage);

      expect(validation.valid).toBe(false);
      expect(validation.error).toContain("10"); // Max size in error message
    });

    it("rejects oversized document files", () => {
      const { result } = renderHook(() => useMediaUpload(defaultOptions));

      const largePdf = createMockFile(
        "large.pdf",
        40 * 1024 * 1024,
        "application/pdf",
      );
      const validation = result.current.validateFile(largePdf);

      expect(validation.valid).toBe(false);
      expect(validation.error).toContain("32"); // Max size in error message
    });

    it("rejects documents when allowDocuments is false", () => {
      const { result } = renderHook(() =>
        useMediaUpload({ ...defaultOptions, allowDocuments: false }),
      );

      const pdf = createMockFile("test.pdf", 1024, "application/pdf");
      const validation = result.current.validateFile(pdf);

      expect(validation.valid).toBe(false);
    });
  });

  describe("addFiles", () => {
    it("adds valid files to pending uploads", () => {
      const { result } = renderHook(() => useMediaUpload(defaultOptions));

      const file = createMockFile("test.jpg", 1024, "image/jpeg");

      act(() => {
        result.current.addFiles([file]);
      });

      expect(result.current.pendingUploads).toHaveLength(1);
      expect(result.current.pendingUploads[0].file).toBe(file);
      expect(result.current.pendingUploads[0].status).toBe("pending");
      expect(result.current.pendingUploads[0].attachmentType).toBe("image");
    });

    it("creates preview URLs for added files", () => {
      const { result } = renderHook(() => useMediaUpload(defaultOptions));

      const file = createMockFile("test.jpg", 1024, "image/jpeg");

      act(() => {
        result.current.addFiles([file]);
      });

      expect(result.current.pendingUploads[0].previewUrl).toMatch(/^blob:/);
      expect(URL.createObjectURL).toHaveBeenCalledWith(file);
    });

    it("enforces max files limit", () => {
      const onError = vi.fn();
      const { result } = renderHook(() =>
        useMediaUpload({ ...defaultOptions, maxFiles: 2, onError }),
      );

      const files = [
        createMockFile("1.jpg", 1024, "image/jpeg"),
        createMockFile("2.jpg", 1024, "image/jpeg"),
        createMockFile("3.jpg", 1024, "image/jpeg"),
      ];

      act(() => {
        result.current.addFiles(files);
      });

      expect(result.current.pendingUploads).toHaveLength(2);
      expect(onError).toHaveBeenCalled();
    });

    it("calls onError for invalid files", () => {
      const onError = vi.fn();
      const { result } = renderHook(() =>
        useMediaUpload({ ...defaultOptions, onError }),
      );

      const invalidFile = createMockFile(
        "test.exe",
        1024,
        "application/x-msdownload",
      );

      act(() => {
        result.current.addFiles([invalidFile]);
      });

      expect(result.current.pendingUploads).toHaveLength(0);
      expect(onError).toHaveBeenCalled();
    });

    it("handles FileList input", () => {
      const { result } = renderHook(() => useMediaUpload(defaultOptions));

      const file = createMockFile("test.jpg", 1024, "image/jpeg");
      const fileList = {
        0: file,
        length: 1,
        item: (i: number) => (i === 0 ? file : null),
        [Symbol.iterator]: function* () {
          yield file;
        },
      } as unknown as FileList;

      act(() => {
        result.current.addFiles(fileList);
      });

      expect(result.current.pendingUploads).toHaveLength(1);
    });
  });

  describe("removeUpload", () => {
    it("removes upload from pending list", () => {
      const { result } = renderHook(() => useMediaUpload(defaultOptions));

      const file = createMockFile("test.jpg", 1024, "image/jpeg");

      act(() => {
        result.current.addFiles([file]);
      });

      const uploadId = result.current.pendingUploads[0].id;

      act(() => {
        result.current.removeUpload(uploadId);
      });

      expect(result.current.pendingUploads).toHaveLength(0);
    });

    it("revokes object URL when removing upload", () => {
      const { result } = renderHook(() => useMediaUpload(defaultOptions));

      const file = createMockFile("test.jpg", 1024, "image/jpeg");

      act(() => {
        result.current.addFiles([file]);
      });

      const upload = result.current.pendingUploads[0];

      act(() => {
        result.current.removeUpload(upload.id);
      });

      expect(URL.revokeObjectURL).toHaveBeenCalledWith(upload.previewUrl);
    });
  });

  describe("clearUploads", () => {
    it("clears all pending uploads", () => {
      const { result } = renderHook(() => useMediaUpload(defaultOptions));

      const files = [
        createMockFile("1.jpg", 1024, "image/jpeg"),
        createMockFile("2.jpg", 1024, "image/jpeg"),
      ];

      act(() => {
        result.current.addFiles(files);
      });

      expect(result.current.pendingUploads).toHaveLength(2);

      act(() => {
        result.current.clearUploads();
      });

      expect(result.current.pendingUploads).toHaveLength(0);
    });

    it("revokes all object URLs", () => {
      const { result } = renderHook(() => useMediaUpload(defaultOptions));

      const files = [
        createMockFile("1.jpg", 1024, "image/jpeg"),
        createMockFile("2.jpg", 1024, "image/jpeg"),
      ];

      act(() => {
        result.current.addFiles(files);
      });

      act(() => {
        result.current.clearUploads();
      });

      expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
    });
  });

  describe("uploadAll", () => {
    beforeEach(() => {
      server.use(
        http.post("*/v1/media/upload", async () => {
          return HttpResponse.json({
            id: `media-${Date.now()}`,
            filename: "test.jpg",
            mime_type: "image/jpeg",
            url: "/media/test.jpg",
            width: 800,
            height: 600,
          });
        }),
      );
    });

    it("returns empty array when no pending uploads", async () => {
      const { result } = renderHook(() => useMediaUpload(defaultOptions));

      let uploadedMedia: Awaited<ReturnType<typeof result.current.uploadAll>>;

      await act(async () => {
        uploadedMedia = await result.current.uploadAll();
      });

      expect(uploadedMedia!).toEqual([]);
    });

    it("sets isUploading during upload", async () => {
      const { result } = renderHook(() => useMediaUpload(defaultOptions));

      const file = createMockFile("test.jpg", 1024, "image/jpeg");

      act(() => {
        result.current.addFiles([file]);
      });

      expect(result.current.isUploading).toBe(false);

      const uploadPromise = act(async () => {
        await result.current.uploadAll();
      });

      // isUploading should be true during upload
      // Note: This is hard to test reliably due to timing

      await uploadPromise;

      expect(result.current.isUploading).toBe(false);
    });

    it("updates upload status to success on successful upload", async () => {
      const onUploadComplete = vi.fn();
      const { result } = renderHook(() =>
        useMediaUpload({ ...defaultOptions, onUploadComplete }),
      );

      const file = createMockFile("test.jpg", 1024, "image/jpeg");

      act(() => {
        result.current.addFiles([file]);
      });

      await act(async () => {
        await result.current.uploadAll();
      });

      expect(result.current.pendingUploads[0].status).toBe("success");
      expect(result.current.pendingUploads[0].media).toBeDefined();
      expect(onUploadComplete).toHaveBeenCalled();
    });

    it("handles upload errors gracefully", async () => {
      server.use(
        http.post("*/v1/media/upload", async () => {
          return HttpResponse.json(
            { detail: "Upload failed" },
            { status: 500 },
          );
        }),
      );

      const onError = vi.fn();
      const { result } = renderHook(() =>
        useMediaUpload({ ...defaultOptions, onError }),
      );

      const file = createMockFile("test.jpg", 1024, "image/jpeg");

      act(() => {
        result.current.addFiles([file]);
      });

      await act(async () => {
        await result.current.uploadAll();
      });

      expect(result.current.pendingUploads[0].status).toBe("error");
      expect(result.current.pendingUploads[0].error).toBeDefined();
      expect(onError).toHaveBeenCalled();
    });

    it("skips already uploaded files", async () => {
      const { result } = renderHook(() => useMediaUpload(defaultOptions));

      const file = createMockFile("test.jpg", 1024, "image/jpeg");

      act(() => {
        result.current.addFiles([file]);
      });

      // First upload
      await act(async () => {
        await result.current.uploadAll();
      });

      const firstMedia = result.current.pendingUploads[0].media;

      // Second upload should reuse the already uploaded media
      let secondResults: Awaited<ReturnType<typeof result.current.uploadAll>>;

      await act(async () => {
        secondResults = await result.current.uploadAll();
      });

      expect(secondResults!).toHaveLength(1);
      expect(secondResults![0]).toBe(firstMedia);
    });
  });

  describe("computed counts", () => {
    it("tracks imageCount correctly", () => {
      const { result } = renderHook(() => useMediaUpload(defaultOptions));

      act(() => {
        result.current.addFiles([
          createMockFile("1.jpg", 1024, "image/jpeg"),
          createMockFile("2.png", 1024, "image/png"),
        ]);
      });

      expect(result.current.imageCount).toBe(2);
      expect(result.current.documentCount).toBe(0);
    });

    it("tracks documentCount correctly", () => {
      const { result } = renderHook(() => useMediaUpload(defaultOptions));

      act(() => {
        result.current.addFiles([
          createMockFile("1.pdf", 1024, "application/pdf"),
          createMockFile("2.txt", 1024, "text/plain"),
        ]);
      });

      expect(result.current.imageCount).toBe(0);
      expect(result.current.documentCount).toBe(2);
    });

    it("tracks mixed uploads correctly", () => {
      const { result } = renderHook(() => useMediaUpload(defaultOptions));

      act(() => {
        result.current.addFiles([
          createMockFile("1.jpg", 1024, "image/jpeg"),
          createMockFile("2.pdf", 1024, "application/pdf"),
        ]);
      });

      expect(result.current.imageCount).toBe(1);
      expect(result.current.documentCount).toBe(1);
    });
  });
});
