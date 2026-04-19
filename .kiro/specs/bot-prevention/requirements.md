# Requirements Document

## Introduction

Aegis is a voice-first dispute intake console that currently allows anonymous access with no bot prevention mechanisms. The application exposes several high-value endpoints — ElevenLabs voice token generation, AI-powered transcript classification, and case submission — all of which are vulnerable to automated abuse. This feature adds layered bot prevention to protect against automated scraping, credential stuffing, resource exhaustion, and API cost abuse while preserving the low-friction experience for legitimate users.

## Glossary

- **Aegis_App**: The Aegis Voice Intake Enforcement Console, a React web application deployed on Cloudflare Workers
- **Rate_Limiter**: A server-side component that tracks and enforces request frequency limits per identity or IP address
- **Challenge_Gate**: A client-side verification mechanism (e.g., Cloudflare Turnstile) that distinguishes human users from automated scripts
- **Server_Function**: A TanStack Start server function (`createServerFn`) that executes on the Cloudflare Worker backend
- **Session**: A Supabase anonymous authentication session tied to a single browser client
- **Fingerprint**: A combination of client-side signals (IP address, user agent, session ID) used to identify a unique client
- **Abuse_Threshold**: A configurable numeric limit defining the maximum number of allowed requests within a time window
- **Cooldown_Period**: A time window during which a client that exceeded an Abuse_Threshold is denied further requests
- **Token_Endpoint**: The `getElevenLabsToken` and `getElevenLabsSignedUrl` server functions that issue ElevenLabs API credentials
- **Classification_Endpoint**: The `classifyTranscript` server function that processes transcript text via AI
- **Case_Submission**: The `commitCase` function that writes a finalized dispute case to the Supabase database

## Requirements

### Requirement 1: Challenge Gate on Session Initialization

**User Story:** As a product owner, I want anonymous sessions to pass a bot challenge before accessing the application, so that automated scripts cannot freely create sessions and consume resources.

#### Acceptance Criteria

1. WHEN a new user loads the Aegis_App for the first time, THE Challenge_Gate SHALL present an invisible bot challenge (e.g., Cloudflare Turnstile) before the Session is created
2. WHEN the Challenge_Gate verification succeeds, THE Aegis_App SHALL proceed with anonymous session creation via Supabase
3. WHEN the Challenge_Gate verification fails, THE Aegis_App SHALL display an error message stating that verification failed and SHALL NOT create a Session
4. IF the Challenge_Gate service is unavailable, THEN THE Aegis_App SHALL allow session creation after a configurable timeout of 5 seconds and SHALL log the bypass event to the server console

### Requirement 2: Rate Limiting on Token Endpoints

**User Story:** As a product owner, I want voice token requests to be rate-limited, so that bots cannot exhaust the ElevenLabs API budget by farming tokens.

#### Acceptance Criteria

1. THE Rate_Limiter SHALL track Token_Endpoint requests per Fingerprint using a sliding window of 60 seconds
2. WHEN a Fingerprint exceeds the Abuse_Threshold of 5 Token_Endpoint requests within the sliding window, THE Rate_Limiter SHALL reject subsequent requests with HTTP status 429 and a JSON body containing `retryAfter` in seconds
3. WHILE a Fingerprint is in a Cooldown_Period, THE Token_Endpoint SHALL reject all requests from that Fingerprint with HTTP status 429
4. THE Rate_Limiter SHALL include the client IP address and Session ID in the Fingerprint calculation

### Requirement 3: Rate Limiting on Classification Endpoint

**User Story:** As a product owner, I want transcript classification requests to be rate-limited, so that bots cannot abuse the AI classification service and inflate API costs.

#### Acceptance Criteria

1. THE Rate_Limiter SHALL track Classification_Endpoint requests per Fingerprint using a sliding window of 60 seconds
2. WHEN a Fingerprint exceeds the Abuse_Threshold of 10 Classification_Endpoint requests within the sliding window, THE Rate_Limiter SHALL reject subsequent requests with HTTP status 429 and a JSON body containing `retryAfter` in seconds
3. THE Classification_Endpoint SHALL validate that the `transcript` input length does not exceed 20,000 characters before processing (note: this validation already exists via Zod schema)

### Requirement 4: Rate Limiting on Case Submission

**User Story:** As a product owner, I want case submissions to be rate-limited per session, so that bots cannot flood the database with fraudulent dispute cases.

#### Acceptance Criteria

1. THE Rate_Limiter SHALL track Case_Submission requests per Session using a sliding window of 300 seconds
2. WHEN a Session exceeds the Abuse_Threshold of 3 Case_Submission requests within the sliding window, THE Rate_Limiter SHALL reject subsequent submissions with HTTP status 429 and a JSON body containing `retryAfter` in seconds
3. IF a Case_Submission request is rejected due to rate limiting, THEN THE Aegis_App SHALL display a toast notification informing the user to wait before submitting another case

### Requirement 5: Server-Side Request Validation

**User Story:** As a developer, I want all server functions to validate request origin and headers, so that direct API calls from scripts outside the browser are blocked.

#### Acceptance Criteria

1. THE Server_Function middleware SHALL verify that each request includes a valid `Origin` or `Referer` header matching the application domain
2. WHEN a request lacks a valid origin header, THE Server_Function middleware SHALL reject the request with HTTP status 403
3. THE Server_Function middleware SHALL verify that each request includes a non-empty `User-Agent` header
4. WHEN a request has an empty or missing `User-Agent` header, THE Server_Function middleware SHALL reject the request with HTTP status 403

### Requirement 6: Client-Side Abuse Signal Detection

**User Story:** As a product owner, I want the application to detect suspicious client-side behavior patterns, so that bot-like interaction patterns are flagged before they reach server endpoints.

#### Acceptance Criteria

1. THE Aegis_App SHALL track the time interval between the page load event and the first Token_Endpoint request
2. WHEN the time interval between page load and the first Token_Endpoint request is less than 2 seconds, THE Aegis_App SHALL flag the session as suspicious and include a `suspiciousSession: true` header in subsequent server requests
3. THE Server_Function middleware SHALL log requests that include the `suspiciousSession` header for monitoring purposes
4. THE Aegis_App SHALL track rapid repeated clicks on the "Start Intake" and "Simulate" buttons within a 3-second window
5. WHEN more than 5 button activations occur within a 3-second window, THE Aegis_App SHALL disable the buttons for 10 seconds and display a message stating "Please wait before trying again"

### Requirement 7: Supabase Row-Level Rate Limiting

**User Story:** As a developer, I want database-level protections against bulk insert abuse, so that even if application-level rate limits are bypassed, the database rejects excessive writes.

#### Acceptance Criteria

1. THE Supabase database SHALL enforce a maximum of 10 case inserts per Session per hour using a database function or trigger
2. WHEN a Session exceeds 10 case inserts within one hour, THE database function SHALL reject the insert and return an error message containing "rate_limit_exceeded"
3. THE Supabase database SHALL enforce a maximum of 100 audit_event inserts per Session per hour using a database function or trigger
4. WHEN a Session exceeds 100 audit_event inserts within one hour, THE database function SHALL reject the insert and return an error message containing "rate_limit_exceeded"

### Requirement 8: Monitoring and Alerting for Bot Activity

**User Story:** As an operations engineer, I want visibility into bot-related events, so that I can detect and respond to ongoing attacks.

#### Acceptance Criteria

1. WHEN the Rate_Limiter rejects a request, THE Server_Function SHALL log the event with the Fingerprint, endpoint name, and timestamp to the server console
2. THE Aegis_App SHALL expose a server-side counter tracking the total number of rate-limited requests per endpoint per 5-minute window
3. WHEN the rate-limited request count for any single endpoint exceeds 50 within a 5-minute window, THE monitoring system SHALL log a warning message containing "bot_attack_suspected" to the server console
