// src/app/api/migration/control/route.ts
import { NextRequest, NextResponse } from 'next/server';

interface MigrationControlRequest {
  action: 'start_experimental' | 'advance_beta' | 'full_rollout' | 'rollback';
}

export async function POST(request: NextRequest) {
  try {
    const { action }: MigrationControlRequest = await request.json();

    // Validate action
    if (!['start_experimental', 'advance_beta', 'full_rollout', 'rollback'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      );
    }

    // Log the migration action (in production, this would update database/config)
    console.log(`🚀 Migration action executed: ${action}`);
    console.log(`📊 Timestamp: ${new Date().toISOString()}`);

    // Simulate action processing
    await new Promise(resolve => setTimeout(resolve, 1000));

    const actionResults = {
      start_experimental: {
        phase: 'experimental',
        userPercentage: 5,
        message: 'Experimental phase started. 5% of users now using Azure TTS.'
      },
      advance_beta: {
        phase: 'beta',
        userPercentage: 25,
        message: 'Advanced to beta phase. 25% of users now using Azure TTS.'
      },
      full_rollout: {
        phase: 'production',
        userPercentage: 100,
        message: 'Full rollout completed. All users now using Azure TTS.'
      },
      rollback: {
        phase: 'rollback',
        userPercentage: 0,
        message: 'Emergency rollback executed. All users reverted to static audio.'
      }
    };

    const result = actionResults[action];

    return NextResponse.json({
      success: true,
      action,
      ...result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Migration control error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    availableActions: [
      'start_experimental',
      'advance_beta', 
      'full_rollout',
      'rollback'
    ],
    description: 'POST to this endpoint with an action to control migration phase'
  });
}