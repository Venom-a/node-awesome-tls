import { LibraryHandler } from "../utils/native";

const instance = LibraryHandler.retrieveLibrary();

export async function request(payload: string) {
  if (!payload) return;
  return instance.request(payload);
}

export async function destroySession(payload: string) {
  if (!payload) return;
  return instance.destroySession(payload);
}

export async function destroyAll() {
  return instance.destroyAll();
}

export async function freeMemory(payload: string) {
  if (!payload) return;
  return instance.freeMemory(payload);
}

export default request;
