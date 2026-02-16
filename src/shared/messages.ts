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
    };

export type RuntimeResponse =
  | {
      ok: true;
      enabled?: boolean;
    }
  | {
      ok: false;
      error: string;
    };

export type RuntimeBroadcast = {
  type: 'EXTENSION_STATE_CHANGED';
  enabled: boolean;
};
