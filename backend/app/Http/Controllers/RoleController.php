<?php

namespace App\Http\Controllers;

use App\Models\Role;

class RoleController extends Controller
{
    public function index()
    {
        return response()->json([
            'success' => true,
            'data' => Role::orderBy('id')->get(),
        ]);
    }
}
