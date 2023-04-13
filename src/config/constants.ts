export const CAPABILITIES = {
  firstRemainingTime: 'spikysummer19613.firstRemainingTime',
  secondRemainingTime: 'spikysummer19613.secondRemainingTime',
  statusMessage: 'spikysummer19613.statusMessage',
  notificationButton: 'spikysummer19613.notificationButton',
  speechSynthesis: 'speechSynthesis',
} as const;

export const SCHEDULES = {
  update: 'update',
  notifications: 'notifications',
} as const;

export const MESSAGES = {
  unauthorized: '인증키가 등록되지 않았어요',
  forbidden: '서비스 접근이 거부되었어요',
  serviceUnavailable: '서버가 요청을 처리할 수 없어요',
  error: '앱에 오류가 발생했어요',
  noBus: '운행 중인 버스가 없어요',
  missedBus: '버스를 놓쳤어요',
  busArrived: '버스가 도착했어요',
  busAlreadyArrived: '버스가 이미 도착했어요',
} as const;
