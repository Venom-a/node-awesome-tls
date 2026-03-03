import { IncomingHttpHeaders, OutgoingHttpHeaders } from "http";

export type Methods = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "OPTIONS" | "HEAD";

export declare enum ClientIdentifier {
    chrome_103 = "chrome_103",
    chrome_104 = "chrome_104",
    chrome_105 = "chrome_105",
    chrome_106 = "chrome_106",
    chrome_107 = "chrome_107",
    chrome_108 = "chrome_108",
    chrome_109 = "chrome_109",
    chrome_110 = "chrome_110",
    chrome_111 = "chrome_111",
    chrome_112 = "chrome_112",
    chrome_116_PSK = "chrome_116_PSK",
    chrome_116_PSK_PQ = "chrome_116_PSK_PQ",
    chrome_117 = "chrome_117",
    chrome_120 = "chrome_120",
    chrome_124 = "chrome_124",
    chrome_131 = "chrome_131",
    chrome_131_psk = "chrome_131_PSK",
    safari_15_6_1 = "safari_15_6_1",
    safari_16_0 = "safari_16_0",
    safari_ipad_15_6 = "safari_ipad_15_6",
    safari_ios_15_5 = "safari_ios_15_5",
    safari_ios_15_6 = "safari_ios_15_6",
    safari_ios_16_0 = "safari_ios_16_0",
    safari_ios_17_0 = "safari_ios_17_0",
    safari_ios_18_0 = "safari_ios_18_0",
    firefox_102 = "firefox_102",
    firefox_104 = "firefox_104",
    firefox_105 = "firefox_105",
    firefox_106 = "firefox_106",
    firefox_108 = "firefox_108",
    firefox_110 = "firefox_110",
    firefox_117 = "firefox_117",
    firefox_120 = "firefox_120",
    firefox_123 = "firefox_123",
    firefox_132 = "firefox_132",
    firefox_133 = "firefox_133",
    opera_89 = "opera_89",
    opera_90 = "opera_90",
    opera_91 = "opera_91",
    zalando_android_mobile = "zalando_android_mobile",
    zalando_ios_mobile = "zalando_ios_mobile",
    nike_ios_mobile = "nike_ios_mobile",
    nike_android_mobile = "nike_android_mobile",
    cloudscraper = "cloudscraper",
    mms_ios = "mms_ios",
    mms_ios_1 = "mms_ios_1",
    mms_ios_2 = "mms_ios_2",
    mms_ios_3 = "mms_ios_3",
    mesh_ios = "mesh_ios",
    mesh_ios_1 = "mesh_ios_1",
    mesh_ios_2 = "mesh_ios_2",
    mesh_android = "mesh_android",
    mesh_android_1 = "mesh_android_1",
    mesh_android_2 = "mesh_android_2",
    confirmed_ios = "confirmed_ios",
    confirmed_android = "confirmed_android",
    okhttp4_android_7 = "okhttp4_android_7",
    okhttp4_android_8 = "okhttp4_android_8",
    okhttp4_android_9 = "okhttp4_android_9",
    okhttp4_android_10 = "okhttp4_android_10",
    okhttp4_android_11 = "okhttp4_android_11",
    okhttp4_android_12 = "okhttp4_android_12",
    okhttp4_android_13 = "okhttp4_android_13"
}

export interface SessionOptions {
    sessionId?: string;
    hexClientHello?: string;
    clientIdentifier?: ClientIdentifier;
    headers?: OutgoingHttpHeaders;
    headerOrder?: string[];
    connectHeaders?: Record<string, string[]>;
    proxy?: string;
    isRotatingProxy?: boolean;
    timeout?: number;
    insecureSkipVerify?: boolean;
    serverNameOverwrite?: string;
    localAddress?: string;
    disableIPV4?: boolean;
    disableIPV6?: boolean;
    debug?: boolean;
}

export interface BaseRequestOptions {
    headers?: OutgoingHttpHeaders;
    headerOrder?: string[];
    connectHeaders?: Record<string, string[]>;
    followRedirects?: boolean;
    proxy?: string;
    isRotatingProxy?: boolean;
    cookies?: Record<string, any>;
    byteResponse?: boolean;
    hostOverride?: string | null;
}

export interface RequestOptions extends BaseRequestOptions {
    body?: any;
}

export interface GetRequestOptions extends BaseRequestOptions {}
export interface PostRequestOptions extends RequestOptions {}
export interface PutRequestOptions extends RequestOptions {}
export interface PatchRequestOptions extends RequestOptions {}
export interface DeleteRequestOptions extends BaseRequestOptions {}
export interface OptionsRequestOptions extends BaseRequestOptions {}
export interface HeadRequestOptions extends BaseRequestOptions {}

export interface fetchOptions {
    method?: Methods;
    headers?: OutgoingHttpHeaders;
    body?: any;
    followRedirects?: boolean;
    proxy?: string;
    isRotatingProxy?: boolean;
    cookies?: Record<string, any>;
    options?: SessionOptions;
}

export interface TlsResponse {
    id: string;
    body: string;
    cookies: Record<string, string>;
    headers: IncomingHttpHeaders;
    sessionId: string;
    status: number;
    target: string;
    usedProtocol: string;
}
