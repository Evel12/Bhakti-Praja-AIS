<?php

namespace App\Mail\Member4;

use Illuminate\Mail\Mailable;

class PortalNotificationMail extends Mailable
{
    public function __construct(public string $notificationTitle, public string $notificationMessage) {}

    public function build()
    {
        return $this->subject($this->notificationTitle)->view('emails.member4-notification');
    }
}
