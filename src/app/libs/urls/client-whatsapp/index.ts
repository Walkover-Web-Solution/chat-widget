import { createUrl } from '@msg91/service';

export const WhatsAppUrls = {
    getWhatsAppLog: (baseUrl) => createUrl(baseUrl, 'logs/wa'),
    getWhatsAppPercentageReport: (baseUrl) =>
        createUrl(baseUrl, 'whatsapp-client-panel/report/?from_date=:fromDate&to_date=:toDate'),
    getWhatsAppNumbers: (baseUrl) => createUrl(baseUrl, 'whatsapp-client-panel/number/'),
    getWebhookDisplayData: (baseUrl) => createUrl(baseUrl, 'webhook-display-data/'),
    createWhatsAppNumbers: (baseUrl) => createUrl(baseUrl, 'whatsapp-client-panel/number/'),
    updateWhatsAppNumbersSetting: (baseUrl) => createUrl(baseUrl, 'whatsapp-client-panel/number/:id'),
    // getHelloTeam: (baseUrl) => createUrl(baseUrl, 'teams/'),
    getAllWhatsAppNumbers: (baseUrl) => createUrl(baseUrl, 'whatsapp-client-numbers/'),
    syncTemplateWithFB: (baseUrl) => createUrl(baseUrl, 'sync-template/:phoneNumber/'),
    syncTemplate: (baseUrl) => createUrl(baseUrl, 'v2/get-template/:phoneNumber/?is_sync=true'),
    getTemplateDetails: (baseUrl) => createUrl(baseUrl, 'get-template/:phoneNumber/'),
    getTemplateAnalyticsData: (baseUrl) => createUrl(baseUrl, 'analytics/wa/template'),
    getTemplateJsonDetails: (baseUrl) => createUrl(baseUrl, 'get-template-curl/'),
    exportLog: (baseUrl) => createUrl(baseUrl, 'whatsapp-client-panel/log/export/'),
    whatsAppProfileSetting: (baseUrl) => createUrl(baseUrl, 'client-profile/:integratedNumber/'),
    getWhatsappLogTimezone: (baseUrl) => createUrl(baseUrl, 'get-timezone/'),
    getUsageType: (baseUrl) => createUrl(baseUrl, `get-usage-types/`),
    getLogDropDownData: (baseUrl) => createUrl(baseUrl, `client-panel-log-dropdown/`),
    getNumberDropDownData: (baseUrl) => createUrl(baseUrl, `client-panel-number-dropdown/`),
    getWhatsAppSystemUserAccessToken: (baseUrl) => createUrl(baseUrl, `whatsApp-system-user-access-token/`),
    countryWisePricing: (baseUrl) => createUrl(baseUrl, `client-panel-dialplan/:id`),
    getWhatsAppStatus: (baseUrl) => createUrl(baseUrl, `whatsapp-status/`),
    getLanguageList: (baseUrl) => createUrl(baseUrl, `client-panel-language-dropdown/`),
    getWhatsappCategories: (baseUrl) => createUrl(baseUrl, `template-category-dropdown/`),
    createTemplate: (baseUrl) => createUrl(baseUrl, `client-panel-template/`),
    editTemplate: (baseUrl) => createUrl(baseUrl, `client-panel-template/:templateId/`),
    assignFreePlan: (baseUrl) => createUrl(baseUrl, `assignFreePlan`),
    subscribePlan: (baseUrl) => createUrl(baseUrl, `plans/subscribe`),
    getFailedLogs: (baseUrl) => createUrl(baseUrl, 'logs/wa?status=failed'),
    exportLogs: (baseUrl) => createUrl(baseUrl, 'exports/:serviceType/'),
    uploadWhatsappTemplateMedia: (baseUrl) => createUrl(baseUrl, 'sample-media-upload/'),
    getCatalogueData: (baseUrl) => createUrl(baseUrl, 'catalog-details/'),
    connectCatalogue: (baseUrl) => createUrl(baseUrl, 'connect_catalog/'),
    getTemplateBulkJsonDetails: (baseUrl) => createUrl(baseUrl, 'get-template-curl/is_bulk/'),
    whatsappBulkSend: (baseUrl) => createUrl(baseUrl, 'whatsapp-outbound-message/bulk/'),
    getCatalogDetails: (baseUrl) => createUrl(baseUrl, 'catalog-details/'),
    getNumbersSettings: (baseUrl) => createUrl(baseUrl, 'enable_ice_breakers/'),
    buttonUrlData: (baseUrl) => createUrl(baseUrl, 'button-url-data/'),
};
