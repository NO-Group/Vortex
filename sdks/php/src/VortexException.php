<?php

namespace NoGroup\Vortex;

class VortexException extends \Exception
{
    public function __construct(public int $status, public string $code, string $message)
    {
        parent::__construct($message);
    }
}
