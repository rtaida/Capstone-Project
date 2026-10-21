<?php
declare(strict_types=1);
require_once __DIR__ . '/env.php';
capraLoadEnv();

const SMTP_HOST = 'smtp.gmail.com';
const SMTP_PORT = 587;
define('SMTP_USERNAME', getenv('CAPRA_SMTP_USERNAME') ?: '');
define('SMTP_PASSWORD', getenv('CAPRA_SMTP_PASSWORD') ?: '');
define('SMTP_FROM_EMAIL', getenv('CAPRA_SMTP_FROM_EMAIL') ?: SMTP_USERNAME);
define('SMTP_FROM_NAME', getenv('CAPRA_SMTP_FROM_NAME') ?: 'Capra Fitness');

function sendPasswordResetOtpEmail(string $toEmail, string $otp): bool
{
    $subject = 'Capra Fitness Password Reset Code';
    $plainText = "Hello,\r\n\r\nWe received a request to reset your Capra Fitness password.\r\n\r\nYour verification code is: {$otp}\r\n\r\nThis code expires in 5 minutes and can only be used once. If you did not request this, you can ignore this email.\r\n\r\nCapra Fitness\r\nForge Your Strength";
    $html = capraEmailShell(
        'Password security',
        'Reset your password',
        'We received a request to reset your Capra Fitness password.',
        '<p style="margin:0 0 18px;color:#d4d0c8;font-size:15px;line-height:1.6;">Use the verification code below to continue.</p>'
        . '<div style="margin:24px 0;padding:20px;text-align:center;background:#191714;border:1px solid #8f6b31;border-radius:8px;">'
        . '<div style="color:#bda46a;font-size:11px;letter-spacing:2px;text-transform:uppercase;">Verification code</div>'
        . '<div style="margin-top:8px;color:#f4d48b;font-size:32px;font-weight:700;letter-spacing:8px;">' . htmlspecialchars($otp, ENT_QUOTES, 'UTF-8') . '</div>'
        . '</div>'
        . '<p style="margin:0;color:#9f9a91;font-size:13px;line-height:1.6;">This code expires in 5 minutes and can only be used once. If you did not request this change, no action is needed.</p>'
    );
    return smtpSendHtml($toEmail, $subject, $html, $plainText);
}

function capraEmailShell(string $eyebrow, string $title, string $intro, string $content): string
{
    return '<!doctype html><html><body style="margin:0;background:#0e0e0d;font-family:Arial,Helvetica,sans-serif;color:#f5f1e8;">'
        . '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0e0e0d;padding:32px 12px;"><tr><td align="center">'
        . '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#151412;border:1px solid #4e3d22;border-radius:10px;overflow:hidden;">'
        . '<tr><td style="padding:26px 34px;background:#0a0a09;border-bottom:1px solid #4e3d22;">'
        . '<div style="font-size:20px;font-weight:700;color:#f4d48b;">Capra Fitness</div>'
        . '<div style="margin-top:5px;color:#918a7c;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;">Forge Your Strength</div>'
        . '</td></tr><tr><td style="padding:38px 34px;">'
        . '<div style="color:#c9a85d;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">' . htmlspecialchars($eyebrow, ENT_QUOTES, 'UTF-8') . '</div>'
        . '<h1 style="margin:12px 0 10px;color:#fff;font-size:32px;line-height:1.15;">' . htmlspecialchars($title, ENT_QUOTES, 'UTF-8') . '</h1>'
        . '<p style="margin:0 0 26px;color:#bdb7ac;font-size:16px;line-height:1.6;">' . htmlspecialchars($intro, ENT_QUOTES, 'UTF-8') . '</p>'
        . $content
        . '</td></tr><tr><td style="padding:20px 34px;border-top:1px solid #302a20;color:#817b70;font-size:12px;line-height:1.5;">This is an automated message from Capra Fitness. Please do not reply to this email.</td></tr>'
        . '</table></td></tr></table></body></html>';
}
function smtpSendPlainText(string $toEmail,string $subject,string $body): bool
{
    return smtpSendMessage($toEmail, $subject, $body, 'text/plain; charset=UTF-8');
}

function smtpSendHtml(string $toEmail, string $subject, string $html, string $plainText): bool
{
    return smtpSendMessage($toEmail, $subject, $plainText, 'text/html; charset=UTF-8', $html);
}

function smtpSendMessage(string $toEmail, string $subject, string $body, string $contentType, ?string $htmlBody = null): bool
{
    if(SMTP_USERNAME===''||SMTP_PASSWORD===''||SMTP_FROM_EMAIL===''){ error_log('SMTP is not configured. Set CAPRA_SMTP_USERNAME/CAPRA_SMTP_PASSWORD/CAPRA_SMTP_FROM_EMAIL.'); return false; }
    $errno=0;$errstr='';$socket=@stream_socket_client('tcp://'.SMTP_HOST.':'.SMTP_PORT,$errno,$errstr,15,STREAM_CLIENT_CONNECT);
    if(!$socket){ error_log("SMTP connection failed: {$errno} {$errstr}"); return false; }
    stream_set_timeout($socket,15);
    try{
        smtpExpect($socket,220); smtpCommand($socket,'EHLO localhost',250); smtpCommand($socket,'STARTTLS',220);
        if(!stream_socket_enable_crypto($socket,true,STREAM_CRYPTO_METHOD_TLS_CLIENT)) throw new RuntimeException('Could not establish SMTP TLS connection.');
        smtpCommand($socket,'EHLO localhost',250); smtpCommand($socket,'AUTH LOGIN',334); smtpCommand($socket,base64_encode(SMTP_USERNAME),334); smtpCommand($socket,base64_encode(SMTP_PASSWORD),235);
        smtpCommand($socket,'MAIL FROM:<'.SMTP_FROM_EMAIL.'>',250); smtpCommand($socket,'RCPT TO:<'.$toEmail.'>',250); smtpCommand($socket,'DATA',354);
        $headers=[
            'From: '.SMTP_FROM_NAME.' <'.SMTP_FROM_EMAIL.'>',
            'To: <'.$toEmail.'>',
            'Subject: '.$subject,
            'MIME-Version: 1.0',
            'Content-Type: '.$contentType,
            'Date: '.date('r'),
        ];
        $message=implode("\r\n",$headers)."\r\n\r\n".($htmlBody ?? $body);
        $message=preg_replace('/(?m)^\./','..',$message);
        fwrite($socket,$message."\r\n.\r\n");
        smtpExpect($socket,250);
        smtpCommand($socket,'QUIT',221);
        fclose($socket);
        return true;
    } catch(Throwable $e){ error_log('SMTP send failed: '.$e->getMessage()); @fwrite($socket,"QUIT\r\n"); fclose($socket); return false; }
}
function smtpRead($socket): string { $r=''; while(($line=fgets($socket,515))!==false){$r.=$line; if(strlen($line)>=4&&$line[3]===' ') break;} return $r; }
function smtpExpect($socket,int $code): string { $r=smtpRead($socket); $actual=(int)substr(trim($r),0,3); if($actual!==$code) throw new RuntimeException("SMTP expected {$code}, received {$actual}: ".trim($r)); return $r; }
function smtpCommand($socket,string $cmd,int $code): string { fwrite($socket,$cmd."\r\n"); return smtpExpect($socket,$code); }
