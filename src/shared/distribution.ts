declare const __APP_STORE__: boolean;
declare const __MICROSOFT_STORE__: boolean;
export const isAppStore = __APP_STORE__;
export const isMicrosoftStore = __MICROSOFT_STORE__;
export const distributionName = isMicrosoftStore ? "Microsoft Store" : isAppStore ? "App Store" : "직접 배포";
export const supportsAutostart = !isAppStore || isMicrosoftStore;
