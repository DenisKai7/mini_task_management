import assert from 'assert';
import { app } from '../server';
import { db } from '../db';

async function runTests() {
  console.log('--- Starting Backend Verification Tests ---');

  // Reset db state for test
  db.clearAll();

  const server = app.listen(0);
  const address = server.address() as any;
  const baseUrl = `http://localhost:${address.port}/api`;

  try {
    // 1. Predefined users
    const usersRes = await fetch(`${baseUrl}/users`);
    const usersData = await usersRes.json();
    assert.strictEqual(usersRes.status, 200);
    assert.ok(usersData.users.includes('john.doe'));
    assert.ok(usersData.users.includes('jane.smith'));
    console.log('✔ GET /api/users returns predefined actors');

    // 2. Create Task
    const createReq = await fetch(`${baseUrl}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Prepare Invoice', description: 'Q1 Customer' }),
    });
    const createData = await createReq.json();
    assert.strictEqual(createReq.status, 201);
    assert.strictEqual(createData.task.status, 'to_do');
    const taskId = createData.task.id;
    console.log('✔ POST /api/tasks sets initial status to "to_do"');

    // 3. Domain Validation: Invalid transition (to_do -> in_progress, skipping pending)
    const invalidReq = await fetch(`${baseUrl}/tasks/${taskId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'in_progress', actor: 'john.doe' }),
    });
    assert.strictEqual(invalidReq.status, 400);
    console.log('✔ Domain Validation: Rejects invalid skip transition (to_do -> in_progress)');

    // 4. Valid Transition: to_do -> pending
    const step1Req = await fetch(`${baseUrl}/tasks/${taskId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'pending', actor: 'john.doe' }),
    });
    const step1Data = await step1Req.json();
    assert.strictEqual(step1Req.status, 200);
    assert.strictEqual(step1Data.task.status, 'pending');
    assert.strictEqual(step1Data.auditLog.from_status, 'to_do');
    assert.strictEqual(step1Data.auditLog.to_status, 'pending');
    assert.strictEqual(step1Data.auditLog.actor, 'john.doe');
    console.log('✔ Valid Transition: to_do -> pending creates audit log');

    // 5. Idempotent Update: pending -> pending
    const idempotentReq = await fetch(`${baseUrl}/tasks/${taskId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'pending', actor: 'john.doe' }),
    });
    const idempotentData = await idempotentReq.json();
    assert.strictEqual(idempotentReq.status, 200);
    assert.strictEqual(idempotentData.unchanged, true);

    // Verify audit log count did not increase
    const logsReq1 = await fetch(`${baseUrl}/tasks/${taskId}/audit-logs`);
    const logsData1 = await logsReq1.json();
    assert.strictEqual(logsData1.auditLogs.length, 1);
    console.log('✔ Idempotency: Same status transition does NOT create duplicate audit log');

    // 6. Valid Transitions: pending -> in_progress -> done
    const step2Req = await fetch(`${baseUrl}/tasks/${taskId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'in_progress', actor: 'jane.smith' }),
    });
    assert.strictEqual(step2Req.status, 200);

    const step3Req = await fetch(`${baseUrl}/tasks/${taskId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'done', actor: 'alice.wong' }),
    });
    assert.strictEqual(step3Req.status, 200);

    // 7. Reject backwards transition from done -> to_do
    const doneAttempt = await fetch(`${baseUrl}/tasks/${taskId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'to_do', actor: 'bob.chen' }),
    });
    assert.strictEqual(doneAttempt.status, 400);
    console.log('✔ Domain Validation: Terminal status "done" cannot be transitioned backwards');

    // 8. Chronological audit logs check
    const finalLogsReq = await fetch(`${baseUrl}/tasks/${taskId}/audit-logs`);
    const finalLogsData = await finalLogsReq.json();
    assert.strictEqual(finalLogsData.auditLogs.length, 3);
    assert.strictEqual(finalLogsData.auditLogs[0].from_status, 'to_do');
    assert.strictEqual(finalLogsData.auditLogs[0].to_status, 'pending');
    assert.strictEqual(finalLogsData.auditLogs[1].from_status, 'pending');
    assert.strictEqual(finalLogsData.auditLogs[1].to_status, 'in_progress');
    assert.strictEqual(finalLogsData.auditLogs[2].from_status, 'in_progress');
    assert.strictEqual(finalLogsData.auditLogs[2].to_status, 'done');
    console.log('✔ Audit Logs: Chronological history correctly recorded (3 events)');

    // 9. Delete task and ensure audit logs persist
    const delReq = await fetch(`${baseUrl}/tasks/${taskId}`, { method: 'DELETE' });
    assert.strictEqual(delReq.status, 200);

    // Audit logs remain in db
    const afterDeleteLogs = db.getAuditLogs(taskId);
    assert.strictEqual(afterDeleteLogs.length, 3);
    console.log('✔ Immutability: Deleting a task does NOT wipe historic audit logs');

    console.log('\n--- ALL TEST SUITES PASSED! ---');
  } finally {
    server.close();
  }
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
