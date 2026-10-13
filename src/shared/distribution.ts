declare const __APP_STORE__: boolean;
export const isAppStore = __APP_STORE__;
export const distributionName = isAppStore ? "App Store" : "직접 배포";
