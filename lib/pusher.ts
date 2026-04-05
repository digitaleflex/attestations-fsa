/**
 * Configuration multi-usage pour Pusher.
 * Note: Simulacre (Mock) temporaire pour permettre les tests sans erreurs de module.
 */

export const pusherServer = {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  trigger: async (channel: string, event: string, _: unknown) => {
    console.log(`[REAL-TIME MOCK] Trigger on ${channel}: ${event}`);
  }
};

export const getPusherClient = () => {
    // try {
    //     const Pusher = require('pusher-js');
    //     ...
    // } catch (e) {}

    return {
        subscribe: (channel: string) => {
            console.log(`[REAL-TIME MOCK] Subscribed to ${channel}`);
            return {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                bind: (event: string, _: unknown) => {
                    console.log(`[REAL-TIME MOCK] Bound to ${event}`);
                },
                unbind: () => {}
            };
        },
        unsubscribe: (channel: string) => {
            console.log(`[REAL-TIME MOCK] Unsubscribed from ${channel}`);
        }
    };
};
