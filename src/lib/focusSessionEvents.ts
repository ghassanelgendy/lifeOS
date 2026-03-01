const manualRecordListeners = new Set<() => void>();

export function requestFocusManualRecord() {
  manualRecordListeners.forEach((listener) => listener());
}

export function onFocusManualRecord(callback: () => void) {
  manualRecordListeners.add(callback);
  return () => {
    manualRecordListeners.delete(callback);
  };
}
