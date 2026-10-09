export const getSelectionText = (): string => window.getSelection()?.toString().trim() ?? "";

