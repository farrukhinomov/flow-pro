export type LocalWriteEffects = {
  notifyLocalDataChanged: () => Promise<void>
  syncAttendanceOutbox: () => Promise<void>
}

export async function runLocalWriteEffects({
  notifyLocalDataChanged,
  syncAttendanceOutbox,
}: LocalWriteEffects) {
  await notifyLocalDataChanged()
  void syncAttendanceOutbox()
}
