// @ts-nocheck
/**
 * Configuration multi-usage pour Pusher.
 * Note: Simulacre (Mock) temporaire pour permettre les tests sans erreurs de module.
 */

export const pusherServer = {
  trigger: async (channel: string, event: string, data: any) => {
    // try {
    //   const Pusher = require('pusher');
    //   ...
    // } catch (e) {}
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
                bind: (event: string, cb: any) => {
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
