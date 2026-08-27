import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

export const middleware = auth((request) => {
	const requestId = crypto.randomUUID();
	const requestHeaders = new Headers(request.headers);
	requestHeaders.set("x-request-id", requestId);
	const response = NextResponse.next({ request: { headers: requestHeaders } });
	response.headers.set("x-request-id", requestId);
	return response;
});

export const config = { matcher: ["/app/:path*", "/api/:path*"] };