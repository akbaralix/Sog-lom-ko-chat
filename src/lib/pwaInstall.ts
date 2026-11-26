export type InstallPlatform = 'android_prompt' | 'ios_safari' | 'browser_manual' | 'standalone';

export function detectInstallPlatform(params: {
  isStandalone: boolean;
  hasDeferredPrompt: boolean;
  userAgent: string;
}): InstallPlatform {
  if (params.isStandalone) return 'standalone';
  if (params.hasDeferredPrompt) return 'android_prompt';
  const ua = params.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'ios_safari';
  return 'browser_manual';
}

export function getInstallInstructionsUz(platform: Exclude<InstallPlatform, 'standalone'>): {
  title: string;
  steps: string[];
} {
  if (platform === 'ios_safari') {
    return {
      title: "iPhone / iPad ekraniga o'rnatish",
      steps: [
        "1. Safari pastki panelidagi Ulashish (Share) tugmasini bosing.",
        "2. Pastga surib \"Asosiy ekranga qo'shish\" (Add to Home Screen) bandini tanlang.",
      ],
    };
  }
  return {
    title: "Android telefoniga ilova sifatida o'rnatish",
    steps: [
      "1. Chrome brauzerida yuqori o'ng burchakdagi menyu (⋮) tugmasini bosing.",
      "2. \"Ilovani o'rnatish\" yoki \"Asosiy ekranga qo'shish\" bandini tanlang — Sog'lom Ko'chat logotipi bilan telefoningizga ilova bo'lib tushadi.",
    ],
  };
}
