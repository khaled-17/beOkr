const express = require('express');
const { google } = require('googleapis');
const fs = require('fs');
require('dotenv').config(); // ✅ تحميل المتغيرات

const app = express();
const port = process.env.PORT || 3000;

// بيانات OAuth2 من ملف .env
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI||'http://localhost:3000/oauth2callback';
const TOKEN_PATH = process.env.TOKEN_PATH || 'tokens.json';

 
const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
 
// ✅ تحميل التوكن من ملف إن وجد
if (fs.existsSync(TOKEN_PATH)) {
  const savedTokens = JSON.parse(fs.readFileSync(TOKEN_PATH));
  oAuth2Client.setCredentials(savedTokens);
  console.log('✅ Loaded saved tokens from file');
}


app.use(express.urlencoded({ extended: true }));


// 🟢 الصفحة الرئيسية - رابط تسجيل الدخول
app.get('/', (req, res) => {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/tasks'],
  });

  res.send(`<a href="${authUrl}">🔐 Login with Google to access your tasks</a>`);
});

// 🟢 صفحة الرد بعد الموافقة
app.get('/oauth2callback', async (req, res) => {
  const code = req.query.code;

  try {
    const { tokens } = await oAuth2Client.getToken(code);
    oAuth2Client.setCredentials(tokens);

    // ✅ خزّن التوكن في ملف
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));

    res.send(`
      ✅ Authentication successful!<br>
      <a href="/tasks">📋 View my tasks</a>
    `);
  } catch (err) {
    res.send('❌ Authentication failed: ' + err.message);
  }
});



app.use(express.json()); // مهم لاستقبال JSON من Postman

app.post('/add-task', async (req, res) => {
  const { tasklistId, title, notes, due } = req.body;

  if (!tasklistId || !title) {
    return res.status(400).json({ message: '❌ tasklistId and title are required' });
  }

  try {
    const tasksApi = google.tasks({ version: 'v1', auth: oAuth2Client });

    const result = await tasksApi.tasks.insert({
      tasklist: tasklistId,
      requestBody: {
        title,
        notes,
        due, // اختياري، يجب أن يكون ISO string مثل: 2025-07-07T12:00:00.000Z
      },
    });

    res.json({ message: '✅ Task created', task: result.data });
  } catch (err) {
    res.status(500).json({ message: '❌ Failed to create task', error: err.message });
  }
});



app.put('/update-task', async (req, res) => {
  const { tasklistId, taskId, title, notes, status, due } = req.body;

  if (!tasklistId || !taskId) {
    return res.status(400).json({ message: '❌ tasklistId and taskId are required' });
  }

  try {
    const tasksApi = google.tasks({ version: 'v1', auth: oAuth2Client });

    const result = await tasksApi.tasks.update({
      tasklist: tasklistId,
      task: taskId,
      requestBody: { title, notes, status, due },
    });

    res.json({ message: '✅ Task updated', task: result.data });
  } catch (err) {
    res.status(500).json({ message: '❌ Failed to update task', error: err.message });
  }
});
app.delete('/task', async (req, res) => {
  const { tasklistId, taskId } = req.body;

  if (!tasklistId || !taskId) {
    return res.status(400).json({ message: '❌ tasklistId and taskId are required' });
  }

  try {
    const tasksApi = google.tasks({ version: 'v1', auth: oAuth2Client });

    await tasksApi.tasks.delete({
      tasklist: tasklistId,
      task: taskId,
    });

    res.json({ message: '✅ Task deleted' });
  } catch (err) {
    res.status(500).json({ message: '❌ Failed to delete task', error: err.message });
  }
});
app.post('/create-tasklist', async (req, res) => {
  const { title } = req.body;

  if (!title) {
    return res.status(400).json({ message: '❌ title is required' });
  }

  try {
    const tasksApi = google.tasks({ version: 'v1', auth: oAuth2Client });

    const result = await tasksApi.tasklists.insert({
      requestBody: { title },
    });

    res.json({ message: '✅ Task list created', taskList: result.data });
  } catch (err) {
    res.status(500).json({ message: '❌ Failed to create task list', error: err.message });
  }
});
app.delete('/tasklist', async (req, res) => {
  const { tasklistId } = req.body;

  if (!tasklistId) {
    return res.status(400).json({ message: '❌ tasklistId is required' });
  }

  try {
    const tasksApi = google.tasks({ version: 'v1', auth: oAuth2Client });

    await tasksApi.tasklists.delete({
      tasklist: tasklistId,
    });

    res.json({ message: '✅ Task list deleted' });
  } catch (err) {
    res.status(500).json({ message: '❌ Failed to delete task list', error: err.message });
  }
});
app.get('/get-task', async (req, res) => {
  const { tasklistId, taskId } = req.query;

  if (!tasklistId || !taskId) {
    return res.status(400).json({ message: '❌ tasklistId and taskId are required' });
  }

  try {
    const result = await google.tasks({ version: 'v1', auth: oAuth2Client }).tasks.get({
      tasklist: tasklistId,
      task: taskId,
    });

    res.json({ message: '✅ Task fetched', task: result.data });
  } catch (err) {
    res.status(500).json({ message: '❌ Failed to fetch task', error: err.message });
  }
});
app.patch('/patch-task', async (req, res) => {
  const { tasklistId, taskId, fieldsToUpdate } = req.body;

  if (!tasklistId || !taskId || !fieldsToUpdate) {
    return res.status(400).json({ message: '❌ Missing required fields' });
  }

  try {
    const result = await google.tasks({ version: 'v1', auth: oAuth2Client }).tasks.patch({
      tasklist: tasklistId,
      task: taskId,
      requestBody: fieldsToUpdate,
    });

    res.json({ message: '✅ Task patched', task: result.data });
  } catch (err) {
    res.status(500).json({ message: '❌ Failed to patch task', error: err.message });
  }
});
app.post('/move-task', async (req, res) => {
  const { tasklistId, taskId, previous, parent } = req.body;

  if (!tasklistId || !taskId) {
    return res.status(400).json({ message: '❌ tasklistId and taskId are required' });
  }

  try {
    const result = await google.tasks({ version: 'v1', auth: oAuth2Client }).tasks.move({
      tasklist: tasklistId,
      task: taskId,
      previous,
      parent,
    });

    res.json({ message: '✅ Task moved', task: result.data });
  } catch (err) {
    res.status(500).json({ message: '❌ Failed to move task', error: err.message });
  }
});
app.post('/clear-completed', async (req, res) => {
  const { tasklistId } = req.body;

  if (!tasklistId) {
    return res.status(400).json({ message: '❌ tasklistId is required' });
  }

  try {
    await google.tasks({ version: 'v1', auth: oAuth2Client }).tasks.clear({
      tasklist: tasklistId,
    });

    res.json({ message: '✅ Completed tasks cleared' });
  } catch (err) {
    res.status(500).json({ message: '❌ Failed to clear completed tasks', error: err.message });
  }
});


// 🟢 عرض المهام من Google Tasks لكل Task List
app.get('/tasks', async (req, res) => {
  try {
    const tasksApi = google.tasks({ version: 'v1', auth: oAuth2Client });

    const tasklistsResponse = await tasksApi.tasklists.list();
    const taskLists = tasklistsResponse.data.items;

    if (!taskLists || !taskLists.length) {
      return res.status(404).json({ message: '❌ No task lists found.' });
    }

    const allTasks = [];

    for (const list of taskLists) {
      const tasksResponse = await tasksApi.tasks.list({
        tasklist: list.id,
      });

      const tasks = tasksResponse.data.items || [];

      allTasks.push({
        taskListTitle: list.title,
        taskListId: list.id,
        taskCount: tasks.length,
        tasks: tasks.map((task) => ({
          id: task.id,
          title: task.title,
          notes: task.notes || '',
          status: task.status,
          due: task.due || null,
        })),
      });
    }

    res.json({
      message: '✅ All tasks fetched successfully',
      totalTaskLists: taskLists.length,
      data: allTasks,
    });

  } catch (err) {
    res.status(500).json({
      message: '❌ Failed to fetch tasks',
      error: err.message,
    });
  }
});


app.get('/html-tasks', async (req, res) => {
  try {
    const tasksApi = google.tasks({ version: 'v1', auth: oAuth2Client });

    const tasklistsResponse = await tasksApi.tasklists.list();
    const taskLists = tasklistsResponse.data.items;

    if (!taskLists || !taskLists.length) {
      return res.send('<h3>❌ No task lists found.</h3>');
    }

    let html = `<h1>📝 Your Google Tasks</h1>
      <form action="/create-tasklist" method="POST" style="margin-bottom:20px;">
        <input type="text" name="title" placeholder="New Task List" required/>
        <button type="submit">➕ Create Task List</button>
      </form>`;

    for (const list of taskLists) {
      // 🟢 Get tasks including completed ones
      const tasksResponse = await tasksApi.tasks.list({
        tasklist: list.id,
        showCompleted: true,
        showDeleted: false,
      });

      const tasks = tasksResponse.data.items || [];

      // 🟢 Count completed percentage
      const completedCount = tasks.filter(t => t.status === 'completed').length;
      const percent = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

      html += `<h2>📋 ${list.title} - ${percent}% complete
        <form action="/delete-tasklist" method="POST" style="display:inline;">
          <input type="hidden" name="tasklistId" value="${list.id}" />
          <button type="submit" style="color:red;">❌ Delete List</button>
        </form>
      </h2><ul>`;

      if (tasks.length === 0) {
        html += '<li>📭 No tasks found.</li>';
      } else {
        for (const task of tasks) {
          html += `<li style="text-decoration: ${task.status === 'completed' ? 'line-through' : 'none'};">
            ✅ <strong>${task.title}</strong> ${task.due ? `(Due: ${new Date(task.due).toLocaleString()})` : ''}
            <form action="/delete-task" method="POST" style="display:inline;">
              <input type="hidden" name="taskId" value="${task.id}" />
              <input type="hidden" name="tasklistId" value="${list.id}" />
              <button type="submit">🗑️</button>
            </form>
            <form action="/update-task" method="POST" style="display:inline;">
              <input type="hidden" name="taskId" value="${task.id}" />
              <input type="hidden" name="tasklistId" value="${list.id}" />
              <input type="text" name="title" placeholder="New title" required/>
              <button type="submit">✏️</button>
            </form>
          </li>`;
        }
      }

      html += `</ul>
        <form action="/add-task" method="POST">
          <input type="hidden" name="tasklistId" value="${list.id}" />
          <input type="text" name="title" placeholder="New task" required/>
          <input type="text" name="notes" placeholder="Notes" />
          <input type="datetime-local" name="due" />
          <button type="submit">➕ Add Task</button>
        </form><hr>`;
    }

    res.send(`
      <html>
        <head>
          <title>Google Tasks</title>
          <style>
            body { font-family: Arial; padding: 20px; background: #f9f9f9; }
            h1 { color: #4A88C5; }
            h2 { color: #555; }
            ul { margin-bottom: 20px; }
            li { margin: 5px 0; }
            form { margin: 5px 0; display: inline; }
            input[type="text"], input[type="datetime-local"] { padding: 5px; margin: 0 5px; }
            button { padding: 5px 10px; margin-left: 5px; }
          </style>
        </head>
        <body>${html}</body>
      </html>
    `);
  } catch (err) {
    res.send('<h3>❌ Error: ' + err.message + '</h3>');
  }
});




// 🟢 تشغيل السيرفر
app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});
