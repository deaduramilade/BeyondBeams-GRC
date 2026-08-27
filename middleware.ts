import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

export const middleware = auth((request) => {
	const response = NextResponse.next();
	response.headers.set("x-request-id", crypto.randomUUID());
	return response;
});

export const config = { matcher: ["/app/:path*", "/api/:path*"] };