<?php

namespace App\Http\Controllers;

class SchoolProfileController extends Controller
{
    public function __invoke()
    {
        return response()->json(['success' => true, 'data' => config('school')]);
    }
}
