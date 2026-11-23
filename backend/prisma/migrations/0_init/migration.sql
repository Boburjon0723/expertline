-- Boshlang‘ich sxema (baseline). Lokal bazadan pg_dump --schema-only orqali olingan, 2026-11-23.
-- uuid-ossp: Supabase’da u `extensions` sxemasida turadi, shuning uchun funksiyalar sxema prefiksisiz chaqiriladi.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

--
-- PostgreSQL database dump
--

-- Dumped from database version 16.16 (Debian 16.16-1.pgdg13+1)
-- Dumped by pg_dump version 16.16 (Debian 16.16-1.pgdg13+1)

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

--
-- Name: service_session_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.service_session_status AS ENUM (
    'initiated',
    'ongoing',
    'completed',
    'cancelled',
    'disputed'
);

--
-- Name: update_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$;

--
-- Name: admin_login_audit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_login_audit (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    user_id uuid,
    phone_or_email character varying(255) NOT NULL,
    ip_address character varying(255),
    user_agent text,
    success boolean NOT NULL,
    reason character varying(50),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

--
-- Name: bots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bots (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    username character varying(100) NOT NULL,
    token_prefix character varying(20) NOT NULL,
    token_hash character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

--
-- Name: chat_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_messages (
    id integer NOT NULL,
    session_id character varying(255),
    sender_id uuid,
    receiver_id uuid,
    text text,
    file_url text,
    type character varying(50) DEFAULT 'text'::character varying,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

--
-- Name: chat_messages_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.chat_messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: chat_messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.chat_messages_id_seq OWNED BY public.chat_messages.id;

--
-- Name: chat_participants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_participants (
    chat_id uuid NOT NULL,
    user_id uuid NOT NULL,
    joined_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    last_read_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    is_pinned boolean DEFAULT false,
    pinned_at timestamp with time zone,
    is_muted boolean DEFAULT false,
    is_archived boolean DEFAULT false,
    unread_marked boolean DEFAULT false
);

--
-- Name: chats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chats (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    creator_id uuid,
    type character varying(50) DEFAULT 'private'::character varying,
    name character varying(255),
    description text,
    avatar_url text,
    link character varying(255),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    metadata jsonb DEFAULT '{}'::jsonb,
    pinned_message_id uuid
);

--
-- Name: company_wallets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.company_wallets (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    axis_company_id character varying(64) NOT NULL,
    owner_user_id uuid,
    company_name character varying(255),
    balance numeric(18,4) DEFAULT 0 NOT NULL,
    locked_balance numeric(18,4) DEFAULT 0 NOT NULL,
    lifetime_earned numeric(18,4) DEFAULT 0 NOT NULL,
    lifetime_spent numeric(18,4) DEFAULT 0 NOT NULL,
    status character varying(32) DEFAULT 'active'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

--
-- Name: escrow; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.escrow (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    user_id uuid,
    service_id uuid,
    booking_id uuid,
    amount numeric(20,4) NOT NULL,
    status character varying(50) DEFAULT 'held'::character varying,
    held_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    released_at timestamp with time zone,
    refunded_at timestamp with time zone,
    metadata jsonb
);

--
-- Name: expenses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expenses (
    id integer NOT NULL,
    user_id uuid,
    amount numeric(15,2) NOT NULL,
    category text NOT NULL,
    description text,
    type text DEFAULT 'expense'::text,
    date date DEFAULT CURRENT_DATE,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT expenses_type_check CHECK ((type = ANY (ARRAY['expense'::text, 'income'::text])))
);

--
-- Name: expenses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.expenses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: expenses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.expenses_id_seq OWNED BY public.expenses.id;

--
-- Name: expert_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expert_reviews (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    expert_id uuid,
    client_id uuid,
    rating integer,
    comment text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT expert_reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);

--
-- Name: job_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_categories (
    id integer NOT NULL,
    name_uz character varying(255) NOT NULL,
    name_ru character varying(255) NOT NULL,
    icon character varying(100),
    is_active boolean DEFAULT true,
    publication_price_mali numeric(20,4) DEFAULT 100.0000,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

--
-- Name: job_categories_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.job_categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: job_categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.job_categories_id_seq OWNED BY public.job_categories.id;

--
-- Name: jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.jobs (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    user_id uuid,
    title character varying(255) NOT NULL,
    description text,
    price character varying(100),
    category character varying(100),
    type character varying(50),
    status character varying(50) DEFAULT 'active'::character varying,
    contact_phone character varying(20),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    sub_type character varying(20) DEFAULT 'seeker'::character varying,
    category_id integer,
    payment_status character varying(20) DEFAULT 'unpaid'::character varying,
    publication_fee numeric(20,4) DEFAULT 0,
    short_text text,
    full_name character varying(255),
    birth_date date,
    location character varying(255),
    experience_years integer,
    salary_min numeric(20,4),
    is_salary_negotiable boolean DEFAULT true,
    skills_json jsonb,
    has_diploma boolean DEFAULT false,
    has_certificate boolean DEFAULT false,
    resume_url text,
    company_name character varying(255),
    responsible_person character varying(255),
    work_type character varying(50),
    work_hours character varying(100),
    day_off character varying(100),
    age_range character varying(50),
    gender_pref character varying(20),
    requirements_json jsonb,
    salary_text character varying(255),
    benefits_json jsonb,
    apply_method_json jsonb
);

--
-- Name: listing_service_deals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.listing_service_deals (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    chat_id uuid NOT NULL,
    expert_id uuid NOT NULL,
    client_id uuid NOT NULL,
    amount numeric(20,4) NOT NULL,
    currency character varying(10) DEFAULT 'MALI'::character varying,
    status character varying(32) DEFAULT 'pending_payment'::character varying NOT NULL,
    transaction_id uuid,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

--
-- Name: live_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.live_sessions (
    id character varying(255) NOT NULL,
    mentor_id uuid,
    title character varying(255),
    status character varying(50) DEFAULT 'active'::character varying,
    recording_url text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    egress_id character varying(255),
    recording_staging_key text
);

--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    chat_id uuid,
    sender_id uuid,
    content text NOT NULL,
    type character varying(50) DEFAULT 'text'::character varying,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    is_read boolean DEFAULT false
);

--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    user_id uuid,
    type character varying(100) NOT NULL,
    title character varying(255) NOT NULL,
    message text,
    data jsonb,
    is_read boolean DEFAULT false,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

--
-- Name: password_reset_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.password_reset_codes (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    user_id uuid,
    code character varying(10) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    is_used boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

--
-- Name: phone_verification_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.phone_verification_codes (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    user_id uuid,
    code character varying(10) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    is_used boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

--
-- Name: platform_balance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_balance (
    id integer NOT NULL,
    balance numeric(20,4) DEFAULT 0.0000,
    total_fees_collected numeric(20,4) DEFAULT 0.0000,
    total_commissions_collected numeric(20,4) DEFAULT 0.0000,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

--
-- Name: platform_balance_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.platform_balance_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: platform_balance_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.platform_balance_id_seq OWNED BY public.platform_balance.id;

--
-- Name: platform_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_settings (
    id integer NOT NULL,
    expert_subscription_fee numeric(10,2) DEFAULT 20.00,
    commission_rate numeric(4,2) DEFAULT 0.10,
    desktop_download_url text,
    desktop_version character varying(20),
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    admin_card_number character varying(32)
);

--
-- Name: platform_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.platform_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: platform_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.platform_settings_id_seq OWNED BY public.platform_settings.id;

--
-- Name: push_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.push_tokens (
    id integer NOT NULL,
    user_id uuid NOT NULL,
    token text NOT NULL,
    platform character varying(20) DEFAULT 'expo'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

--
-- Name: push_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.push_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: push_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.push_tokens_id_seq OWNED BY public.push_tokens.id;

--
-- Name: quiz_options; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quiz_options (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    question_id uuid NOT NULL,
    option_text text NOT NULL,
    is_correct boolean DEFAULT false,
    order_index integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

--
-- Name: quiz_questions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quiz_questions (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    quiz_id uuid NOT NULL,
    question_text text NOT NULL,
    question_type character varying(50) DEFAULT 'multiple_choice'::character varying,
    order_index integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT quiz_questions_question_type_check CHECK (((question_type)::text = ANY ((ARRAY['multiple_choice'::character varying, 'true_false'::character varying, 'open_ended'::character varying])::text[])))
);

--
-- Name: quiz_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quiz_results (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    quiz_id uuid NOT NULL,
    student_id uuid NOT NULL,
    score integer DEFAULT 0,
    total_questions integer DEFAULT 0,
    completed_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

--
-- Name: quizzes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quizzes (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    session_id character varying(255) NOT NULL,
    mentor_id uuid,
    title character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

--
-- Name: security_event_audit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.security_event_audit (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    event character varying(64) NOT NULL,
    user_id uuid,
    ip_address character varying(255),
    user_agent text,
    success boolean NOT NULL,
    reason character varying(255),
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

--
-- Name: service_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_sessions (
    id integer NOT NULL,
    expert_id uuid,
    client_id uuid,
    chat_id text,
    amount_mali numeric(15,8) NOT NULL,
    status public.service_session_status DEFAULT 'initiated'::public.service_session_status,
    started_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    completed_at timestamp without time zone,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

--
-- Name: service_sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.service_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: service_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.service_sessions_id_seq OWNED BY public.service_sessions.id;

--
-- Name: services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.services (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    provider_id uuid,
    category character varying(100) NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    price_mali numeric(20,4) NOT NULL,
    duration_minutes integer DEFAULT 60,
    is_active boolean DEFAULT true,
    rating numeric(3,2) DEFAULT 0.00,
    total_bookings integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

--
-- Name: session_materials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session_materials (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    session_id character varying(255) NOT NULL,
    uploader_id uuid,
    title character varying(255) NOT NULL,
    file_url text NOT NULL,
    file_type character varying(50),
    file_size_bytes bigint DEFAULT 0,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    id character varying(255) NOT NULL,
    service_id uuid,
    provider_id uuid,
    client_id uuid,
    escrow_id uuid,
    video_url text,
    platform character varying(50) DEFAULT 'jitsi'::character varying,
    status character varying(50) DEFAULT 'scheduled'::character varying,
    started_at timestamp with time zone,
    ended_at timestamp with time zone,
    duration_seconds integer,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

--
-- Name: settlement_nonces; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.settlement_nonces (
    key_id character varying(64) NOT NULL,
    nonce character varying(128) NOT NULL,
    expires_at timestamp with time zone NOT NULL
);

--
-- Name: settlement_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.settlement_transactions (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    type character varying(16) NOT NULL,
    status character varying(32) NOT NULL,
    axis_order_id character varying(128),
    buyer_company_id character varying(64),
    seller_company_id character varying(64),
    buyer_wallet_id uuid,
    seller_wallet_id uuid,
    amount numeric(18,4) NOT NULL,
    commission_rate numeric(8,6) DEFAULT 0.01 NOT NULL,
    commission_amount numeric(18,4) DEFAULT 0 NOT NULL,
    net_amount numeric(18,4) DEFAULT 0 NOT NULL,
    idempotency_key character varying(128) NOT NULL,
    related_hold_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

--
-- Name: settlement_wallet_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.settlement_wallet_links (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    company_wallet_id uuid NOT NULL,
    axis_company_id character varying(64) NOT NULL,
    key_id character varying(64) NOT NULL,
    hmac_secret_hash text NOT NULL,
    status character varying(32) DEFAULT 'active'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

--
-- Name: specialist_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.specialist_notes (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    specialist_id uuid,
    client_id uuid,
    booking_id uuid,
    content text NOT NULL,
    is_private boolean DEFAULT true,
    shared_with_client boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    note_type character varying(20) DEFAULT 'client'::character varying
);

--
-- Name: student_mentor_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.student_mentor_subscriptions (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    student_id uuid NOT NULL,
    mentor_id uuid NOT NULL,
    started_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone NOT NULL,
    amount_paid numeric(20,2) DEFAULT 0 NOT NULL,
    transaction_id uuid,
    created_at timestamp with time zone DEFAULT now()
);

--
-- Name: token_balances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.token_balances (
    user_id uuid NOT NULL,
    balance numeric(20,4) DEFAULT 0.0000,
    locked_balance numeric(20,4) DEFAULT 0.0000,
    pin_hash character varying(255),
    is_locked boolean DEFAULT false,
    recovery_status character varying(50),
    recovery_requested_at timestamp with time zone,
    lifetime_earned numeric(20,4) DEFAULT 0.0000,
    lifetime_spent numeric(20,4) DEFAULT 0.0000,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT token_balances_balance_nonneg CHECK ((balance >= (0)::numeric)),
    CONSTRAINT token_balances_locked_nonneg CHECK ((locked_balance >= (0)::numeric))
);

--
-- Name: topup_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.topup_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    amount numeric(20,2) NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

--
-- Name: transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transactions (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    sender_id uuid,
    receiver_id uuid,
    amount numeric(20,4) NOT NULL,
    fee numeric(20,4) DEFAULT 0,
    net_amount numeric(20,4) NOT NULL,
    type character varying(50) NOT NULL,
    status character varying(50) DEFAULT 'pending'::character varying,
    reference_type character varying(64),
    reference_id uuid,
    note text,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

--
-- Name: user_blocks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_blocks (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    blocker_id uuid,
    blocked_id uuid,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

--
-- Name: user_contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_contacts (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    user_id uuid,
    contact_user_id uuid,
    custom_name character varying(255),
    custom_surname character varying(255),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

--
-- Name: user_crypto_keys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_crypto_keys (
    user_id uuid NOT NULL,
    alg character varying(16) DEFAULT 'x25519'::character varying NOT NULL,
    public_key text NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

--
-- Name: user_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_profiles (
    user_id uuid NOT NULL,
    bio text,
    is_expert boolean DEFAULT false,
    profession character varying(255),
    specialization text,
    experience_years integer DEFAULT 0,
    service_price numeric(20,4) DEFAULT 0,
    working_hours character varying(255),
    languages text,
    rating numeric(3,2) DEFAULT 0.00,
    verified_status character varying(50) DEFAULT 'unverified'::character varying,
    wiloyat character varying(100),
    tuman character varying(100),
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    specialization_details text,
    has_diploma boolean DEFAULT false,
    institution character varying(255),
    current_workplace character varying(255),
    diploma_url text,
    certificate_url text,
    id_url text,
    selfie_url text,
    resume_url text,
    anketa_url text,
    pricing_model character varying(20) DEFAULT 'hourly'::character varying,
    hourly_rate numeric(20,4) DEFAULT 0,
    currency character varying(10) DEFAULT 'MALI'::character varying,
    service_languages text,
    service_format character varying(100),
    bio_expert text,
    specialty_desc text,
    expert_proposal text,
    services_json jsonb,
    expert_groups text,
    expert_fee_total numeric(20,4) DEFAULT 0
);

--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    phone character varying(20) NOT NULL,
    password_hash character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    surname character varying(255),
    age integer,
    username character varying(100),
    email character varying(255),
    avatar_url text,
    role character varying(50) DEFAULT 'user'::character varying,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    refresh_token text,
    is_expert_active boolean DEFAULT false,
    subscription_end_date timestamp with time zone,
    telegram_chat_id bigint,
    telegram_link_code character varying(32),
    phone_verified boolean DEFAULT true
);

--
-- Name: whiteboard_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.whiteboard_snapshots (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    session_id character varying(255) NOT NULL,
    snapshot_data text NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

--
-- Name: chat_messages id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages ALTER COLUMN id SET DEFAULT nextval('public.chat_messages_id_seq'::regclass);

--
-- Name: expenses id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses ALTER COLUMN id SET DEFAULT nextval('public.expenses_id_seq'::regclass);

--
-- Name: job_categories id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_categories ALTER COLUMN id SET DEFAULT nextval('public.job_categories_id_seq'::regclass);

--
-- Name: platform_balance id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_balance ALTER COLUMN id SET DEFAULT nextval('public.platform_balance_id_seq'::regclass);

--
-- Name: platform_settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_settings ALTER COLUMN id SET DEFAULT nextval('public.platform_settings_id_seq'::regclass);

--
-- Name: push_tokens id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_tokens ALTER COLUMN id SET DEFAULT nextval('public.push_tokens_id_seq'::regclass);

--
-- Name: service_sessions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_sessions ALTER COLUMN id SET DEFAULT nextval('public.service_sessions_id_seq'::regclass);

--
-- Name: admin_login_audit admin_login_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_login_audit
    ADD CONSTRAINT admin_login_audit_pkey PRIMARY KEY (id);

--
-- Name: bots bots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bots
    ADD CONSTRAINT bots_pkey PRIMARY KEY (id);

--
-- Name: bots bots_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bots
    ADD CONSTRAINT bots_username_key UNIQUE (username);

--
-- Name: chat_messages chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_pkey PRIMARY KEY (id);

--
-- Name: chat_participants chat_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_participants
    ADD CONSTRAINT chat_participants_pkey PRIMARY KEY (chat_id, user_id);

--
-- Name: chats chats_link_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chats
    ADD CONSTRAINT chats_link_key UNIQUE (link);

--
-- Name: chats chats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chats
    ADD CONSTRAINT chats_pkey PRIMARY KEY (id);

--
-- Name: company_wallets company_wallets_axis_company_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_wallets
    ADD CONSTRAINT company_wallets_axis_company_id_key UNIQUE (axis_company_id);

--
-- Name: company_wallets company_wallets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_wallets
    ADD CONSTRAINT company_wallets_pkey PRIMARY KEY (id);

--
-- Name: escrow escrow_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.escrow
    ADD CONSTRAINT escrow_pkey PRIMARY KEY (id);

--
-- Name: expenses expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_pkey PRIMARY KEY (id);

--
-- Name: expert_reviews expert_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expert_reviews
    ADD CONSTRAINT expert_reviews_pkey PRIMARY KEY (id);

--
-- Name: job_categories job_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_categories
    ADD CONSTRAINT job_categories_pkey PRIMARY KEY (id);

--
-- Name: jobs jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_pkey PRIMARY KEY (id);

--
-- Name: listing_service_deals listing_service_deals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.listing_service_deals
    ADD CONSTRAINT listing_service_deals_pkey PRIMARY KEY (id);

--
-- Name: live_sessions live_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_sessions
    ADD CONSTRAINT live_sessions_pkey PRIMARY KEY (id);

--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);

--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);

--
-- Name: password_reset_codes password_reset_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_codes
    ADD CONSTRAINT password_reset_codes_pkey PRIMARY KEY (id);

--
-- Name: phone_verification_codes phone_verification_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.phone_verification_codes
    ADD CONSTRAINT phone_verification_codes_pkey PRIMARY KEY (id);

--
-- Name: platform_balance platform_balance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_balance
    ADD CONSTRAINT platform_balance_pkey PRIMARY KEY (id);

--
-- Name: platform_settings platform_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_settings
    ADD CONSTRAINT platform_settings_pkey PRIMARY KEY (id);

--
-- Name: push_tokens push_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_tokens
    ADD CONSTRAINT push_tokens_pkey PRIMARY KEY (id);

--
-- Name: push_tokens push_tokens_user_id_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_tokens
    ADD CONSTRAINT push_tokens_user_id_token_key UNIQUE (user_id, token);

--
-- Name: quiz_options quiz_options_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_options
    ADD CONSTRAINT quiz_options_pkey PRIMARY KEY (id);

--
-- Name: quiz_questions quiz_questions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_questions
    ADD CONSTRAINT quiz_questions_pkey PRIMARY KEY (id);

--
-- Name: quiz_results quiz_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_results
    ADD CONSTRAINT quiz_results_pkey PRIMARY KEY (id);

--
-- Name: quiz_results quiz_results_quiz_id_student_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_results
    ADD CONSTRAINT quiz_results_quiz_id_student_id_key UNIQUE (quiz_id, student_id);

--
-- Name: quizzes quizzes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quizzes
    ADD CONSTRAINT quizzes_pkey PRIMARY KEY (id);

--
-- Name: security_event_audit security_event_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_event_audit
    ADD CONSTRAINT security_event_audit_pkey PRIMARY KEY (id);

--
-- Name: service_sessions service_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_sessions
    ADD CONSTRAINT service_sessions_pkey PRIMARY KEY (id);

--
-- Name: services services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_pkey PRIMARY KEY (id);

--
-- Name: session_materials session_materials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_materials
    ADD CONSTRAINT session_materials_pkey PRIMARY KEY (id);

--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);

--
-- Name: settlement_nonces settlement_nonces_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settlement_nonces
    ADD CONSTRAINT settlement_nonces_pkey PRIMARY KEY (key_id, nonce);

--
-- Name: settlement_transactions settlement_transactions_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settlement_transactions
    ADD CONSTRAINT settlement_transactions_idempotency_key_key UNIQUE (idempotency_key);

--
-- Name: settlement_transactions settlement_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settlement_transactions
    ADD CONSTRAINT settlement_transactions_pkey PRIMARY KEY (id);

--
-- Name: settlement_wallet_links settlement_wallet_links_key_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settlement_wallet_links
    ADD CONSTRAINT settlement_wallet_links_key_id_key UNIQUE (key_id);

--
-- Name: settlement_wallet_links settlement_wallet_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settlement_wallet_links
    ADD CONSTRAINT settlement_wallet_links_pkey PRIMARY KEY (id);

--
-- Name: specialist_notes specialist_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.specialist_notes
    ADD CONSTRAINT specialist_notes_pkey PRIMARY KEY (id);

--
-- Name: student_mentor_subscriptions student_mentor_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_mentor_subscriptions
    ADD CONSTRAINT student_mentor_subscriptions_pkey PRIMARY KEY (id);

--
-- Name: student_mentor_subscriptions student_mentor_subscriptions_student_id_mentor_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_mentor_subscriptions
    ADD CONSTRAINT student_mentor_subscriptions_student_id_mentor_id_key UNIQUE (student_id, mentor_id);

--
-- Name: token_balances token_balances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.token_balances
    ADD CONSTRAINT token_balances_pkey PRIMARY KEY (user_id);

--
-- Name: topup_requests topup_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.topup_requests
    ADD CONSTRAINT topup_requests_pkey PRIMARY KEY (id);

--
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);

--
-- Name: user_blocks user_blocks_blocker_id_blocked_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_blocks
    ADD CONSTRAINT user_blocks_blocker_id_blocked_id_key UNIQUE (blocker_id, blocked_id);

--
-- Name: user_blocks user_blocks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_blocks
    ADD CONSTRAINT user_blocks_pkey PRIMARY KEY (id);

--
-- Name: user_contacts user_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_contacts
    ADD CONSTRAINT user_contacts_pkey PRIMARY KEY (id);

--
-- Name: user_contacts user_contacts_user_id_contact_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_contacts
    ADD CONSTRAINT user_contacts_user_id_contact_user_id_key UNIQUE (user_id, contact_user_id);

--
-- Name: user_crypto_keys user_crypto_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_crypto_keys
    ADD CONSTRAINT user_crypto_keys_pkey PRIMARY KEY (user_id);

--
-- Name: user_profiles user_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_pkey PRIMARY KEY (user_id);

--
-- Name: users users_phone_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_phone_key UNIQUE (phone);

--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);

--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);

--
-- Name: whiteboard_snapshots whiteboard_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whiteboard_snapshots
    ADD CONSTRAINT whiteboard_snapshots_pkey PRIMARY KEY (id);

--
-- Name: idx_bots_token_prefix; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bots_token_prefix ON public.bots USING btree (token_prefix);

--
-- Name: idx_bots_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bots_user_id ON public.bots USING btree (user_id);

--
-- Name: idx_bots_username; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bots_username ON public.bots USING btree (username);

--
-- Name: idx_expenses_user_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expenses_user_date ON public.expenses USING btree (user_id, date DESC);

--
-- Name: idx_listing_deals_chat; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_listing_deals_chat ON public.listing_service_deals USING btree (chat_id);

--
-- Name: idx_listing_deals_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_listing_deals_status ON public.listing_service_deals USING btree (status);

--
-- Name: idx_messages_chat_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_chat_created ON public.messages USING btree (chat_id, created_at DESC);

--
-- Name: idx_notifications_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user ON public.notifications USING btree (user_id);

--
-- Name: idx_security_event_audit_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_security_event_audit_created_at ON public.security_event_audit USING btree (created_at DESC);

--
-- Name: idx_security_event_audit_event; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_security_event_audit_event ON public.security_event_audit USING btree (event);

--
-- Name: idx_settlement_tx_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_settlement_tx_order ON public.settlement_transactions USING btree (axis_order_id);

--
-- Name: idx_subscriptions_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_expires ON public.student_mentor_subscriptions USING btree (expires_at);

--
-- Name: idx_transactions_receiver; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transactions_receiver ON public.transactions USING btree (receiver_id);

--
-- Name: idx_transactions_reference; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transactions_reference ON public.transactions USING btree (reference_type, reference_id);

--
-- Name: idx_transactions_sender_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transactions_sender_created ON public.transactions USING btree (sender_id, created_at DESC);

--
-- Name: uq_subscriptions_student_mentor; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_subscriptions_student_mentor ON public.student_mentor_subscriptions USING btree (student_id, mentor_id);

--
-- Name: chats update_chats_modtime; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_chats_modtime BEFORE UPDATE ON public.chats FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

--
-- Name: services update_services_modtime; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_services_modtime BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

--
-- Name: token_balances update_token_balances_modtime; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_token_balances_modtime BEFORE UPDATE ON public.token_balances FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

--
-- Name: user_profiles update_user_profiles_modtime; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_user_profiles_modtime BEFORE UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

--
-- Name: users update_users_modtime; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_users_modtime BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

--
-- Name: admin_login_audit admin_login_audit_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_login_audit
    ADD CONSTRAINT admin_login_audit_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;

--
-- Name: bots bots_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bots
    ADD CONSTRAINT bots_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: chat_messages chat_messages_receiver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_receiver_id_fkey FOREIGN KEY (receiver_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: chat_messages chat_messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: chat_messages chat_messages_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.live_sessions(id) ON DELETE CASCADE;

--
-- Name: chat_participants chat_participants_chat_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_participants
    ADD CONSTRAINT chat_participants_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.chats(id) ON DELETE CASCADE;

--
-- Name: chat_participants chat_participants_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_participants
    ADD CONSTRAINT chat_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: chats chats_creator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chats
    ADD CONSTRAINT chats_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.users(id) ON DELETE SET NULL;

--
-- Name: company_wallets company_wallets_owner_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_wallets
    ADD CONSTRAINT company_wallets_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES public.users(id) ON DELETE SET NULL;

--
-- Name: escrow escrow_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.escrow
    ADD CONSTRAINT escrow_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE SET NULL;

--
-- Name: escrow escrow_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.escrow
    ADD CONSTRAINT escrow_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;

--
-- Name: expenses expenses_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: expert_reviews expert_reviews_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expert_reviews
    ADD CONSTRAINT expert_reviews_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: expert_reviews expert_reviews_expert_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expert_reviews
    ADD CONSTRAINT expert_reviews_expert_id_fkey FOREIGN KEY (expert_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: jobs jobs_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.job_categories(id);

--
-- Name: jobs jobs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: listing_service_deals listing_service_deals_chat_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.listing_service_deals
    ADD CONSTRAINT listing_service_deals_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.chats(id) ON DELETE CASCADE;

--
-- Name: listing_service_deals listing_service_deals_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.listing_service_deals
    ADD CONSTRAINT listing_service_deals_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: listing_service_deals listing_service_deals_expert_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.listing_service_deals
    ADD CONSTRAINT listing_service_deals_expert_id_fkey FOREIGN KEY (expert_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: listing_service_deals listing_service_deals_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.listing_service_deals
    ADD CONSTRAINT listing_service_deals_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.transactions(id) ON DELETE SET NULL;

--
-- Name: live_sessions live_sessions_mentor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_sessions
    ADD CONSTRAINT live_sessions_mentor_id_fkey FOREIGN KEY (mentor_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: messages messages_chat_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.chats(id) ON DELETE CASCADE;

--
-- Name: messages messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id) ON DELETE SET NULL;

--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: password_reset_codes password_reset_codes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_codes
    ADD CONSTRAINT password_reset_codes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: phone_verification_codes phone_verification_codes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.phone_verification_codes
    ADD CONSTRAINT phone_verification_codes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: quiz_options quiz_options_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_options
    ADD CONSTRAINT quiz_options_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.quiz_questions(id) ON DELETE CASCADE;

--
-- Name: quiz_questions quiz_questions_quiz_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_questions
    ADD CONSTRAINT quiz_questions_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES public.quizzes(id) ON DELETE CASCADE;

--
-- Name: quiz_results quiz_results_quiz_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_results
    ADD CONSTRAINT quiz_results_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES public.quizzes(id) ON DELETE CASCADE;

--
-- Name: quiz_results quiz_results_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_results
    ADD CONSTRAINT quiz_results_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: quizzes quizzes_mentor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quizzes
    ADD CONSTRAINT quizzes_mentor_id_fkey FOREIGN KEY (mentor_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: security_event_audit security_event_audit_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_event_audit
    ADD CONSTRAINT security_event_audit_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;

--
-- Name: service_sessions service_sessions_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_sessions
    ADD CONSTRAINT service_sessions_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: service_sessions service_sessions_expert_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_sessions
    ADD CONSTRAINT service_sessions_expert_id_fkey FOREIGN KEY (expert_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: services services_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: session_materials session_materials_uploader_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_materials
    ADD CONSTRAINT session_materials_uploader_id_fkey FOREIGN KEY (uploader_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: sessions sessions_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: sessions sessions_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: settlement_transactions settlement_transactions_buyer_wallet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settlement_transactions
    ADD CONSTRAINT settlement_transactions_buyer_wallet_id_fkey FOREIGN KEY (buyer_wallet_id) REFERENCES public.company_wallets(id);

--
-- Name: settlement_transactions settlement_transactions_related_hold_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settlement_transactions
    ADD CONSTRAINT settlement_transactions_related_hold_id_fkey FOREIGN KEY (related_hold_id) REFERENCES public.settlement_transactions(id);

--
-- Name: settlement_transactions settlement_transactions_seller_wallet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settlement_transactions
    ADD CONSTRAINT settlement_transactions_seller_wallet_id_fkey FOREIGN KEY (seller_wallet_id) REFERENCES public.company_wallets(id);

--
-- Name: settlement_wallet_links settlement_wallet_links_company_wallet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settlement_wallet_links
    ADD CONSTRAINT settlement_wallet_links_company_wallet_id_fkey FOREIGN KEY (company_wallet_id) REFERENCES public.company_wallets(id) ON DELETE CASCADE;

--
-- Name: specialist_notes specialist_notes_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.specialist_notes
    ADD CONSTRAINT specialist_notes_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: specialist_notes specialist_notes_specialist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.specialist_notes
    ADD CONSTRAINT specialist_notes_specialist_id_fkey FOREIGN KEY (specialist_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: student_mentor_subscriptions student_mentor_subscriptions_mentor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_mentor_subscriptions
    ADD CONSTRAINT student_mentor_subscriptions_mentor_id_fkey FOREIGN KEY (mentor_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: student_mentor_subscriptions student_mentor_subscriptions_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_mentor_subscriptions
    ADD CONSTRAINT student_mentor_subscriptions_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: student_mentor_subscriptions student_mentor_subscriptions_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_mentor_subscriptions
    ADD CONSTRAINT student_mentor_subscriptions_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.transactions(id);

--
-- Name: token_balances token_balances_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.token_balances
    ADD CONSTRAINT token_balances_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: topup_requests topup_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.topup_requests
    ADD CONSTRAINT topup_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);

--
-- Name: transactions transactions_receiver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_receiver_id_fkey FOREIGN KEY (receiver_id) REFERENCES public.users(id) ON DELETE SET NULL;

--
-- Name: transactions transactions_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id) ON DELETE SET NULL;

--
-- Name: user_blocks user_blocks_blocked_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_blocks
    ADD CONSTRAINT user_blocks_blocked_id_fkey FOREIGN KEY (blocked_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: user_blocks user_blocks_blocker_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_blocks
    ADD CONSTRAINT user_blocks_blocker_id_fkey FOREIGN KEY (blocker_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: user_contacts user_contacts_contact_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_contacts
    ADD CONSTRAINT user_contacts_contact_user_id_fkey FOREIGN KEY (contact_user_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: user_contacts user_contacts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_contacts
    ADD CONSTRAINT user_contacts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: user_crypto_keys user_crypto_keys_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_crypto_keys
    ADD CONSTRAINT user_crypto_keys_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: user_profiles user_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- PostgreSQL database dump complete
--
