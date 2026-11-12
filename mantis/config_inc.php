<?php

$g_hostname = 'mantis-db';
$g_db_type = 'mysqli';
$g_database_name = 'bugtracker';
$g_db_username = 'mantisbt';
$g_db_password = getenv('MANTIS_DB_PASSWORD');
$g_crypto_master_salt = getenv('MANTIS_CRYPTO_SALT');
$g_path = getenv('MANTIS_BASE_URL');

$g_default_language = 'spanish';
$g_default_timezone = 'America/Argentina/Jujuy';

// El correo de prueba se consulta en Mailpit; no se entrega a direcciones externas.
$g_phpMailer_method = PHPMAILER_METHOD_SMTP;
$g_smtp_host = getenv('MANTIS_SMTP_HOST') ?: 'mantis-correo';
$g_smtp_port = (int) (getenv('MANTIS_SMTP_PORT') ?: 1025);
$g_smtp_connection_mode = getenv('MANTIS_SMTP_CONNECTION_MODE') ?: '';
$g_smtp_username = getenv('MANTIS_SMTP_USER') ?: '';
$g_smtp_password = getenv('MANTIS_SMTP_PASSWORD') ?: '';
$g_from_email = getenv('MANTIS_FROM_EMAIL') ?: 'mantis@example.invalid';
$g_enable_email_notification = ON;
$g_send_reset_password = ON;
$g_lost_password_feature = ON;
$g_allow_anonymous_login = OFF;
