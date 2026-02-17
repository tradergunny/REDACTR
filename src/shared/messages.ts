import type { PIIEvent } from './events';
import type { DetectionSettings } from './storage';

export type RuntimeRequest =
  | {
      type: 'CONTENT_SCRIPT_BOOTSTRAP';
      pageUrl: string;
      pageTitle: string;
    }
  | {
      type: 'GET_EXTENSION_STATE';
    }
  | {
      type: 'SET_EXTENSION_STATE';
      enabled: boolean;
    }
  | {
      type: 'GET_DETECTION_SETTINGS';
    }
  | {
      type: 'SET_DETECTION_SETTINGS';
      settings: Partial<DetectionSettings>;
    }
  | {
      type: 'TRACK_PII_EVENT';
      event: PIIEvent;
    };

export type RuntimeResponse =
  | {
      ok: true;
      enabled?: boolean;
      settings?: DetectionSettings;
    }
  | {
      ok: false;
      error: string;
    };

export type RuntimeBroadcast = {
  type: 'EXTENSION_STATE_CHANGED';
  enabled: boolean;
} | {
  type: 'DETECTION_SETTINGS_CHANGED';
  settings: DetectionSettings;
};
