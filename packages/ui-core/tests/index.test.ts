import { describe, it, expect, vi, beforeEach } from "vitest";
import { FieldBinder, PresenceManager } from "../src/index";
import { EventEmitter } from "zerithdb-core";

describe("FieldBinder", () => {
  let appMock: any;
  let dbMock: any;
  let syncMock: any;

  beforeEach(() => {
    dbMock = {
      findOne: vi.fn(),
      update: vi.fn(),
    };
    syncMock = new EventEmitter();
    appMock = {
      db: vi.fn(() => dbMock),
      sync: syncMock,
    };
  });

  it("should initialize with initial value from db", async () => {
    dbMock.findOne.mockResolvedValueOnce({ _id: "doc1", title: "Hello" });
    const binder = new FieldBinder(appMock, "posts", "doc1", "title");

    const changeSpy = vi.fn();
    binder.on("change", changeSpy);

    await binder.bind();

    expect(dbMock.findOne).toHaveBeenCalledWith({ _id: "doc1" });
    expect(changeSpy).toHaveBeenCalledWith("Hello");
    expect(binder.getValue()).toBe("Hello");
  });

  it("should optimistically update and then call db update", async () => {
    dbMock.findOne.mockResolvedValueOnce({ _id: "doc1", title: "Hello" });
    dbMock.update.mockResolvedValueOnce(undefined);
    const binder = new FieldBinder(appMock, "posts", "doc1", "title");

    await binder.bind();

    const changeSpy = vi.fn();
    binder.on("change", changeSpy);

    await binder.update("World");

    expect(changeSpy).toHaveBeenCalledWith("World");
    expect(binder.getValue()).toBe("World");
    expect(dbMock.update).toHaveBeenCalledWith({ _id: "doc1" }, { $set: { title: "World" } });
  });

  it("should rollback on validation error", async () => {
    dbMock.findOne.mockResolvedValueOnce({ _id: "doc1", title: "Hello" });
    const binder = new FieldBinder(appMock, "posts", "doc1", "title");

    await binder.bind();

    // Mock an error during update
    dbMock.update.mockRejectedValueOnce(new Error("Validation failed"));

    const changeSpy = vi.fn();
    const errorSpy = vi.fn();
    binder.on("change", changeSpy);
    binder.on("error", errorSpy);

    await binder.update("World");

    // It should have changed to World optimistically, then back to Hello
    expect(changeSpy).toHaveBeenNthCalledWith(1, "World");
    expect(changeSpy).toHaveBeenNthCalledWith(2, "Hello");
    expect(errorSpy).toHaveBeenCalled();
    expect(binder.getValue()).toBe("Hello");
  });
});

describe("PresenceManager", () => {
  it("should bind and emit presence changes", () => {
    const appMock: any = {};
    const manager = new PresenceManager(appMock, "posts", "doc1", "title");

    const changeSpy = vi.fn();
    manager.on("presence:change", changeSpy);
    manager.bind();

    expect(changeSpy).toHaveBeenCalled();
  });
});
