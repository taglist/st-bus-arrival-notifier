import type * as st from '@smartthings/core-sdk';
import type { Dictionary } from '@taglist/types';

declare global {
  namespace Types {
    const FIRST_REMAINING_TIME = 'natureconcert14384.firstRemainingTime';
    const SECOND_REMAINING_TIME = 'natureconcert14384.secondRemainingTime';
    const STATUS_MESSAGE = 'natureconcert14384.statusMessage';
    const NOTIFICATION_BUTTON = 'natureconcert14384.notificationButton';

    type PreferenceType = 'integer' | 'number' | 'boolean' | 'string' | 'enumeration';

    interface Preference<T> {
      preferenceType: PreferenceType;
      value: T;
    }

    interface Preferences extends Dictionary {
      notificationInterval: Preference<number>;
    }

    interface Capabilities extends Dictionary, st.CapabilityStatus {
      [FIRST_REMAINING_TIME]: {
        remainingTime: AttributeState;
      };
      [SECOND_REMAINING_TIME]: {
        remainingTime: AttributeState;
      };
      [STATUS_MESSAGE]: {
        message: AttributeState;
      };
    }
  }
}

type Values<T> = T[keyof T];

type AttributeState = Values<st.CapabilityStatus>;

export {};
