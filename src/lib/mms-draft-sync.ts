export interface MmsDraft<TFile> {
  body: string
  files: TFile[]
}

export function settleMmsDraft<TFile>(
  drafts: Map<string, MmsDraft<TFile>>,
  pendingId: string,
  success: boolean,
): { handled: boolean; restore?: MmsDraft<TFile> } {
  const draft = drafts.get(pendingId)
  if (!draft) return { handled: false }
  drafts.delete(pendingId)
  return success ? { handled: true } : { handled: true, restore: draft }
}
