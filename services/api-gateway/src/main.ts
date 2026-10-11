import express, { Request, Response } from 'express';

const app = express();
app.use(express.json());

const COURSE_SERVICE_URL = process.env.COURSE_SERVICE_URL || 'http://localhost:3001';
const ASSIGNMENT_SERVICE_URL = process.env.ASSIGNMENT_SERVICE_URL || 'http://localhost:3002';
const PORT = process.env.PORT || 3000;

// Health check endpoint with downstream health checks
app.get('/health', async (req: Request, res: Response) => {
  const checkService = async (url: string) => {
    try {
      const resp = await fetch(`${url}/courses`, { signal: AbortSignal.timeout(1500) }).catch(() => null);
      if (resp && resp.ok) return 'UP';
      // Try base endpoint
      const baseResp = await fetch(url, { signal: AbortSignal.timeout(1500) }).catch(() => null);
      return baseResp ? 'UP' : 'DOWN';
    } catch {
      return 'DOWN';
    }
  };

  const courseHealth = await checkService(COURSE_SERVICE_URL);
  const assignmentHealth = await checkService(ASSIGNMENT_SERVICE_URL);

  res.json({
    status: 'UP',
    timestamp: new Date().toISOString(),
    gateway: {
      port: PORT,
      status: 'HEALTHY',
    },
    downstreamServices: {
      courseService: {
        url: COURSE_SERVICE_URL,
        status: courseHealth,
      },
      assignmentService: {
        url: ASSIGNMENT_SERVICE_URL,
        status: assignmentHealth,
      },
    },
  });
});

// Root metadata and routing registry
app.get('/', (req: Request, res: Response) => {
  res.json({
    name: 'Learning Platform API Gateway',
    version: '1.0.0',
    description: 'Single Entry Point for all microservices',
    endpoints: {
      health: 'GET /health',
      courses: {
        list: 'GET /api/courses',
        create: 'POST /api/courses',
        getById: 'GET /api/courses/:id',
        publish: 'POST /api/courses/:id/publish',
      },
      assignments: {
        list: 'GET /api/assignments',
        create: 'POST /api/assignments',
        getById: 'GET /api/assignments/:id',
      },
      students: {
        register: 'POST /api/students',
        getById: 'GET /api/students/:id',
      },
      documentation: {
        courseServiceSwagger: `${COURSE_SERVICE_URL}/api/docs`,
        assignmentServiceSwagger: `${ASSIGNMENT_SERVICE_URL}/api/docs`,
      },
    },
  });
});

// Proxy helper function using modern fetch
async function proxyRequest(targetUrl: string, req: Request, res: Response) {
  try {
    const fetchOptions: RequestInit = {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(5000),
    };

    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body && Object.keys(req.body).length > 0) {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const response = await fetch(targetUrl, fetchOptions);
    const contentType = response.headers.get('content-type');

    res.status(response.status);
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      res.json(data);
    } else {
      const text = await response.text();
      res.send(text);
    }
  } catch (error) {
    console.error(`[GATEWAY ERROR] Failed to proxy to ${targetUrl}:`, (error as Error).message);
    res.status(502).json({
      error: 'Bad Gateway',
      message: `Unable to reach downstream service at ${targetUrl}`,
      details: (error as Error).message,
    });
  }
}

// Route: Courses -> Course Service
app.all('/api/courses*', (req: Request, res: Response) => {
  const targetPath = req.originalUrl.replace('/api/courses', '/courses');
  const targetUrl = `${COURSE_SERVICE_URL}${targetPath}`;
  proxyRequest(targetUrl, req, res);
});

// Route: Assignments -> Assignment Service
app.all('/api/assignments*', (req: Request, res: Response) => {
  const targetPath = req.originalUrl.replace('/api/assignments', '/assignments');
  const targetUrl = `${ASSIGNMENT_SERVICE_URL}${targetPath}`;
  proxyRequest(targetUrl, req, res);
});

// Route: Students -> Assignment Service
app.all('/api/students*', (req: Request, res: Response) => {
  const targetPath = req.originalUrl.replace('/api/students', '/students');
  const targetUrl = `${ASSIGNMENT_SERVICE_URL}${targetPath}`;
  proxyRequest(targetUrl, req, res);
});

app.listen(PORT, () => {
  console.log(`[API GATEWAY] Running on http://localhost:${PORT}`);
  console.log(`[API GATEWAY] Routing /api/courses -> ${COURSE_SERVICE_URL}`);
  console.log(`[API GATEWAY] Routing /api/assignments & /api/students -> ${ASSIGNMENT_SERVICE_URL}`);
});
