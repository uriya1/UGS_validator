# Supersonic Wisdom SDK — Remotely Controllable Feature Flags

All keys below can be controlled via **Wisdom Remote Config**, **UGS Remote Config**, **A/B**, or **Deep Link** (priority: Deep Link > A/B > UGS Remote > Wisdom Remote > Local). Types and default values are from the SDK local config; effects are inferred from code usage.

---

## Ads strategy (level-based & interstitials)

| Key | Type | Default | Effect |
|-----|------|---------|--------|
| **swAdsLevelBasedMinLevel** | int | 1 | Minimum regular level from which interstitials can be shown. **-1 = no interstitials**. |
| **swAdsLevelBasedIsInstlBeforeRv** | bool | false | When true, show interstitial *before* rewarded video opportunity when between levels; when false, interstitial can show *after* RV opportunity missed. |
| **swAdsLevelBasedBetweenLevelsTimer** | string | "20" | Timer (seconds) for between-levels interstitial opportunity. Format: single value or "level:seconds" mapping. |
| **swAdsLevelBasedPlaytimeTimer** | string | "" | Playtime-based interstitial timer for regular gameplay. Format: "level:seconds" (e.g. "1:90,6:60"). |
| **swAdsLevelBasedNoTouchBetweenLevelsTimer** | string | "20" | No-touch timer between levels for interstitial. |
| **swAdsLevelBasedNoTouchPlaytimeTimer** | string | "20" | No-touch playtime timer for interstitial during gameplay. |
| **swAdsLevelBasedBonusPlaytimeTimer** | string | "" | Playtime timer for bonus levels. |
| **swAdsLevelBasedBonusNoTouchPlaytimeTimer** | string | "20" | No-touch playtime timer for bonus levels. |
| **swMetaLevelBasedPlaytimeTimer** | string | "1:90,6:60,11:50" | Meta (non-level) playtime timer for interstitials. |
| **swMetaLevelBasedNoTouchPlaytimeTimer** | string | "20" | Meta no-touch playtime timer. |
| **swAdsLevelBasedTotalMinLevelFailure** | int | -1 | Minimum total level failures before interstitials/App Open can show. **-1 = disabled**. |
| **swAdsTotalMinSecond** | int | -1 (level-based) | Minimum total seconds of play before ads (level-based games). Time-based games use swAdsTimeBasedTotalMinSecond. |
| **swAdsAppOpenBeforeInterstitial** | bool | true | When true, prefer showing App Open ad before interstitials when applicable. |
| **swAdsAppOpenAdEnabled** | bool | false | Enables App Open ad unit. |
| **swAdsAdTimeout** | float | 5 | Ad load timeout in seconds. |
| **swAdsVerboseTracking** | bool | false | Extra logging for ads strategy. |
| **swShouldNoTouchTimersCountInBackground** | bool | true | Whether no-touch timers continue counting when app is in background. |
| **swAdsFreeZoneTimeoutTimeSec** | int | 120 | Ad-free zone max duration in seconds. |
| **swAdsFreeZoneVerboseTracking** | bool | false | Verbose logging for ad-free zone. |
| **swUiTriggerPointsEnabled** | bool | false | Enables UI trigger points for ad opportunities. |
| **swTriggerPointExcludePlacements** | string | null | Comma-separated placement names to exclude from trigger points. |
| **swAdsMinGameSession** | int | -1 | Minimum game session count before ads. **-1 = no minimum**. |
| **swAdsMinActiveDay** | int | -1 | Minimum active day before ads. **-1 = no minimum**. |

### Time-based ads

| Key | Type | Default | Effect |
|-----|------|---------|--------|
| **swAdsTimeBasedMinSecond** | int | 0 | Minimum time (seconds) before first ad in time-based games. |
| **swAdsTimeBasedTotalMinSecond** | int | 120 | Minimum total playtime (seconds) before ads in time-based games. |
| **swAdsTimeBasedPlaytimeTimer** | string | "0:90,6:60,11:50" | Playtime timer for time-based mode. |
| **swAdsTimeBasedNoTouchPlaytimeTimer** | string | "20" | No-touch playtime timer (time-based). |
| **swMetaTimeBasedPlaytimeTimer** | string | "0:90,6:60,11:50" | Meta playtime timer (time-based). |
| **swMetaTimeBasedNoTouchPlaytimeTimer** | string | "20" | Meta no-touch playtime timer (time-based). |

### RV cooldown

| Key | Type | Default | Effect |
|-----|------|---------|--------|
| **swAdsCooldownAfterRvTimer** | string | "-1" | Cooldown (seconds) after rewarded video before next ad. **-1 = no cooldown**. |
| **swAdsCooldownAfterRvReset** | float | -1 | Reset behavior for RV cooldown. |
| **swAdsCooldownAfterRvDisableReset** | int | -1 | Disable reset of RV cooldown (special value). |

### App Open & AdMob

| Key | Type | Default | Effect |
|-----|------|---------|--------|
| **swAdsAppOpenMaxLoadRetryAttempts** | int | 3 | Max retry attempts for App Open ad load. |

---

## Ad revenue & behavior

| Key | Type | Default | Effect |
|-----|------|---------|--------|
| **swShowISInsteadRV** | bool | false | When true, show interstitial instead of rewarded video in certain flows. |
| **swRewardedISNonManagedEarlyPreload** | bool | false | Early preload for rewarded interstitial when managed ads are disabled. |
| **swAdsBannersEnabled** | bool | true | Enables banner ads. |
| **swDataEnrichmentEnabled** | bool | false | Enables ad event data enrichment for tracking. |
| **swAdsRevenueVendorsReport** | string | null | Comma-separated list of ad revenue vendors to report. |
| **swIapRevenueVendorsReport** | string | null | Comma-separated list of IAP revenue vendors to report. |

---

## Ads notifier (countdown / in-ad messaging)

| Key | Type | Default | Effect |
|-----|------|---------|--------|
| **adsNotifierEnabled** | bool | true (Android/Editor), false (iOS) | Shows "Ads in X" countdown notification. |
| **adsNotificationBackgroundColor** | string | "#00000099" | Background color of ads notification. |
| **adsNotificationTextColor** | string | "#ffffff" | Text color. |
| **adsNotificationMessageText** | string | "Ads in" | Message prefix for countdown. |
| **adsNotificationHeightPosition** | int | 15 | Vertical position (percentage). |
| **adsNotificationSideRight** | bool | true | If true, align to right. |
| **adsNotifierShouldReportEvent** | bool | false | Report notifier events to analytics. |
| **adsNotificationScale** | float | 0.7 | Scale of notification UI. |
| **adsNotificationGlobalCountdownInterval** | float | 5 | Global countdown interval (seconds). |
| **adsNotificationPlaytimeCountdownInterval** | float | 5 | Playtime-based countdown interval. |
| **adsNotificationNoTouchPlaytimeCountdownInterval** | float | 5 | No-touch playtime countdown interval. |
| **adsNotificationNoTouchBetweenLevelsCountdownInterval** | float | 5 | No-touch between-levels countdown interval. |

---

## Promotion / banner X (Stage 30)

| Key | Type | Default | Effect |
|-----|------|---------|--------|
| **swBannerXEnabled** | bool | false | Enables the promotion banner (e.g. “Remove Ads” banner). |
| **swBannerXHorizontalPositon** | int | 100 | Horizontal position of banner (percentage). |
| **swBannerXHighlightColor** | string | (SwColors.CYAN_HEX) | Highlight color (hex). |
| **swBannerXBackroundColor** | string | (SwColors.BLUE_HEX) | Background color (hex). |

## Promotion / banner X (Stage 40)

| Key | Type | Default | Effect |
|-----|------|---------|--------|
| **swBannerXmode** | int | 1 (NO_ADS_IAP_TRY_DEV_POPUP_MODE) | Banner mode: 1 = try no-ads IAP + dev popup behavior. |
| **swBannerXbundle** | string | "" | Custom bundle identifier for promotion. |

---

## Initial revenue & events

| Key | Type | Default | Effect |
|-----|------|---------|--------|
| **swInitialRvEvent** | bool | false | Report initial RV (rewarded video) event. |
| **swInitialMegaSessionRvEvent** | bool | false | Report initial mega-session RV event. |

---

## UGS (Unity Gaming Services) & Cloud Save

| Key | Type | Default | Effect |
|-----|------|---------|--------|
| **swUgsEnableAutomaticRemoteConfigRequests** | bool | false | Enable automatic UGS Remote Config requests. |
| **swUgsRemoteConfigVerboseTracking** | bool | false | Verbose logging for UGS Remote Config. |
| **swUgsCloudSaveVerboseTracking** | bool | false | Verbose logging for Cloud Save. |
| **swCloudSaveAutoFetchCooldown** | int | -1 | Cooldown (seconds) between auto-fetches. **-1 = disabled**. |
| **swCloudSaveEnabled** | int | 0 | 0 = disabled; non-zero can enable Cloud Save. |

---

## Install source & app update

| Key | Type | Default | Effect |
|-----|------|---------|--------|
| **swInstallSourcePopupEnabled** | bool | false | Show popup when install source is unofficial. |
| **swInstallSourcePopupTitle** | string | "Oops! You've got the unofficial version" | Popup title. |
| **swInstallSourcePopupBody** | string | "Click here to download\nthe original one." | Popup body. |
| **swDownloadSourceBlocklistAddition** | string | "" | Comma-separated sources to add to blocklist. |
| **swDownloadSourceBlocklistRemoval** | string | "" | Comma-separated sources to remove from blocklist. |
| **swAppUpdatePopupType** | string | "None" | Type of app-update popup (e.g. None, Permode). |
| **swAppUpdateWisdomPopupEnabled** | bool | true | Use Wisdom custom update popup. |
| **swAppUpdateNativePopupType** | string | "Permode" | Native store update popup type. |
| **swAppUpdateCustomPopupText** | string | "A new version of the app is ready for you." | Custom popup text. |
| **swAppUpdateCustomPopupTitle** | string | "Update Available" | Custom popup title. |
| **swAppUpdateCustomPopupButtonText** | string | "Update" | Custom button text. |

---

## No internet

| Key | Type | Default | Effect |
|-----|------|---------|--------|
| **swNoInternetMinimumLevelEnforcement** | int | 0 | Minimum level before no-internet popup is enforced. |
| **swNoInternetMinimumSecondEnforcement** | int | 0 | Minimum playtime (seconds) before no-internet popup. |
| **swNoInternetLoadingGameOfflineCountdown** | int | -1 | Countdown (seconds) when loading game offline; after that show popup. **-1 = disabled**. |
| **swNoInternetDuringGameplayOfflineCountdown** | int | -1 | Countdown during gameplay when offline. **-1 = disabled**. |
| **swNoInternetBetweenLevelsOfflineCountdown** | int | -1 | Countdown between levels when offline. **-1 = disabled**. |
| **swNoInternetPopupText** | string | "Waiting for connection" | Message shown in no-internet popup. |
| **swNoInternetIsNoAdsDisableNoInternetFlow** | bool | true | When user has no-ads, disable no-internet flow (Stage 40). |

---

## Privacy, consent & CMP

| Key | Type | Default | Effect |
|-----|------|---------|--------|
| **swGdprCmpFlowEnabled** | bool | true | Enable GDPR CMP (consent) flow. |
| **swGdprConsentBeforeAtt** | bool | false | Show GDPR consent before ATT prompt. |
| **swCcpaPopupSettingsTitle** | string | "Data Privacy Settings" | CCPA settings popup title. |
| **swCcpaPopupSettingsSubtitle** | string | "Do not sell or share my personal information" | CCPA toggle subtitle. |
| **swCcpaPopupSettingsBody** | string | "" | CCPA popup body text. |
| **swCcpaPopupSettingsBodyFontSize** | int | 30 | CCPA body font size. |
| **swCmpVerboseTracking** | bool | false | Verbose CMP logging. |
| **swCmpGoogleAdsTestDeviceIds** | string | "[]" | JSON array of Google Ads test device IDs. |
| **swCmpDebugGeography** | string | "" | CMP debug geography override. |
| **swCmpResetConsentInformation** | bool | false | Reset consent (debug). |
| **swCmpCap** | int | 1 | CMP cap (e.g. max prompts). |
| **enableAgeVerification** | bool | false | Enable age verification step. |

---

## Rate us

| Key | Type | Default | Effect |
|-----|------|---------|--------|
| **swRateUsPopup** | bool | true | Enables rate-us popup. |
| **swRateUsTimerCooldown** | int | 19 | Cooldown (e.g. levels/sessions) between rate-us prompts. |
| **swRateUsPopupTesting** | bool | false | Testing mode for rate-us (e.g. show every time). |

---

## Notifications

| Key | Type | Default | Effect |
|-----|------|---------|--------|
| **swLocalNotifications** | string | (JSON) | Full local notifications config (scheduling, permission timing, list of notifications). |
| **swIosUninstallMeasurementRequired** | bool | false | Whether iOS uninstall measurement requires notification permission. |

---

## Third-party reporting & AppsFlyer

| Key | Type | Default | Effect |
|-----|------|---------|--------|
| **swThirdPartyLevelAchievedReportingCap** | int | 50 | Cap on level-achieved events sent to third parties. |
| **swThirdPartyLevelAchievedInterval** | int | 5 | Send level-achieved every N levels. |
| **appsFlyerDomain** | string | "appsflyersdk.com" | AppsFlyer domain. |
| **swAppsFlyerTotalNettoPlayTime** | string | "" | Override/custom netto playtime key for AppsFlyer. |
| **swAppsFlyerTotalBruttoPlayTime** | string | "" | Override/custom brutto playtime key. |
| **swAppsFlyerTotalGameplayReportingCap** | string | "400" | Cap for total gameplay reporting to AppsFlyer. |

---

## Conversion value (CV) & SKAN

| Key | Type | Default | Effect |
|-----|------|---------|--------|
| **cvModel** | string | "none" | Legacy CV model name. |
| **cvModelNumberAddition** | int | 32 | Number added in CV model. |
| **cvModelProgressionLevel** | int | 8 | Progression level used in CV model. |
| **swSkanScheme** | string | null | SKAdNetwork scheme override. |

---

## IAP (Stage 40)

| Key | Type | Default | Effect |
|-----|------|---------|--------|
| **enableNoAdsApproval** | bool | false | Require approval before granting no-ads. |
| **afIosValidationEnabled** | bool | true | Enable AppsFlyer server-side receipt validation on iOS. |
| **afIosValidationExcludedProductIds** | string | "[]" | JSON array of product IDs excluded from AF iOS validation. |
| **swIapInitRetry** | int | 0 | Number of IAP initialization retries. |
| **swAFBasicReceiptValidationEnabled** | bool | false | Enable basic receipt validation via AppsFlyer. |
| **swIsROI360IapEnabled** | bool | false | Enable ROI 360 IAP purchase reporting. |
| **enableAppStoreProductPreload** | bool | true | Preload App Store products. |

---

## Cross-promo

| Key | Type | Default | Effect |
|-----|------|---------|--------|
| **swCrossPromoAutoOpenInstalledGame** | bool | false | Automatically open game when cross-promo target is already installed. |

---

## Game blocker & DNS

| Key | Type | Default | Effect |
|-----|------|---------|--------|
| **availabilityMessage** | string | "This game is unavailable in your country" | Message when game is blocked by country. |
| **swAdProtectionEnabled** | bool | false | Enable ad protection (DNS/domain check). |
| **swAdProtectionVerbose** | bool | false | Verbose ad protection logging. |
| **swIronSourceMediationDomain** | string | "gw.mediation.unity3d.com" | Expected mediation domain for ad protection. |

---

## Core & init

| Key | Type | Default | Effect |
|-----|------|---------|--------|
| **swInitTimeoutTimeInSeconds** | float | 5 | SDK init timeout (seconds). |
| **swShouldReportConfigIterationEvent** | bool | true | Report config iteration/fetch events. |

---

## Game session & alive

| Key | Type | Default | Effect |
|-----|------|---------|--------|
| **swGameSessionEndInterval** | float | 10 | Seconds of inactivity before game session is considered ended. |
| **swAliveEventIntervals** | int | -1 | Interval for alive/heartbeat events. **-1 = disabled**. |

---

## FPS & analytics

| Key | Type | Default | Effect |
|-----|------|---------|--------|
| **swFpsMeasurementIntervals** | int | 1 | Interval (e.g. seconds) between FPS measurements. |
| **swFpsCriticalThreshold** | int | 20 | FPS value below which is considered critical. |
| **swFpsShouldReportInvalidFps** | bool | false | Report invalid/low FPS to analytics. |

---

## SwSettings (overwritable via remote / deep link)

These are **field names** (not config keys); they are written to PlayerPrefs when provided via remote config or deep link. Only **bool** fields are overwritten in code.

| Field | Type | Effect |
|-------|------|--------|
| **enableDebug** | bool | Enables debug logging. |
| **debugAdMediationPartner** | bool | Debug IronSource/Level Play/MAX. |
| **testBlockingApiInvocation** | bool | Test blocking API behavior. |
| **enableTestAds** | bool | Use test ads. |
| **enableDevtools** | bool | Enable dev tools. |
| **logViaNetwork** | bool | Send logs via network. |

---

## Notes

- **Timer format:** Many ad timers use strings like `"20"` (single value in seconds) or `"1:90,6:60,11:50"` (level:seconds or minute:seconds).
- **-1** often means “disabled” or “no limit” for numeric flags.
- Config **source priority**: Deep Link > A/B > UGS Remote > Wisdom Remote > Local (SwLocalConfig).
- This list is extracted from `*LocalConfig.cs` and config accessors; remote keys must match these key names to take effect.
