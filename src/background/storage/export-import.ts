import { storageService } from "./storage-service";

export const exportAll = async (): Promise<string> => {
  const data = await storageService.getAll();
  return JSON.stringify(data, null, 2);
};

export const importAll = async (raw: string): Promise<void> => {
  const json = JSON.parse(raw);
  await storageService.setAll(json);
};

