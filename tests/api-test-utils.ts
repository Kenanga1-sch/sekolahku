import { NextRequest, NextResponse } from 'next/server';

export function createMockRequest(options: {
    method?: string;
    body?: any;
    url?: string;
    params?: Record<string, string>;
}) {
    const { method = 'GET', body, url = 'http://localhost:3000', params = {} } = options;

    const reqOptions: any = {
        method,
        headers: {
            'content-type': 'application/json',
        },
    };

    if (body) {
        reqOptions.body = JSON.stringify(body);
    }

    const req = new NextRequest(url, reqOptions);

    return req;
}

export async function parseJsonResponse(res: NextResponse) {
    return await res.json();
}
