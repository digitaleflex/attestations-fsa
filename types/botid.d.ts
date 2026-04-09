declare module 'botid/server' {
  export function checkBotId(options?: any): Promise<{ 
    isHuman: boolean; 
    isBot: boolean;
    isVerifiedBot: boolean;
    bypassed: boolean;
    verifiedBotName?: string;
    verifiedBotCategory?: string;
    classificationReason?: string;
  }>;
}

declare module 'botid/client' {
  import * as React from 'react';
  export const BotIdClient: React.FC<{ 
    protect: Array<{ 
      path: string, 
      method: string, 
      advancedOptions?: { checkLevel?: 'deepAnalysis' | 'basic' } 
    }> 
  }>;
}

declare module 'botid/next/config' {
  export function withBotId(config: any): any;
}
