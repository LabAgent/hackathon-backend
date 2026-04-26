export const RESEARCH_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'web_search',
      description:
        'Search the web for scientific articles, research papers, tutorials, and information. Returns structured results with titles, summaries, and links.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
          count: {
            type: 'number',
            description: 'Number of results (1-10)',
            default: 5,
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_experiment_log',
      description: 'Create a new experiment log entry for a project. The projectId can be a numeric ID or a project name (will be fuzzy-matched).',
      parameters: {
        type: 'object',
        properties: {
          projectId: { type: 'string', description: 'ID or name of the project' },
          result: {
            type: 'string',
            description: 'Experiment result description',
          },
          success: {
            type: 'boolean',
            description: 'Whether the experiment was successful',
          },
          notes: { type: 'string', description: 'Additional notes' },
          hypothesis: {
            type: 'string',
            description: 'The hypothesis being tested',
          },
          methodology: {
            type: 'string',
            description: 'The methodology used for the experiment',
          },
          status: {
            type: 'string',
            enum: ['planned', 'in_progress', 'completed', 'failed'],
            description: 'Experiment status',
          },
        },
        required: ['projectId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'suggest_hypothesis',
      description:
        'Generate scientific hypotheses based on a research topic and existing data. Checks research cache for prior knowledge.',
      parameters: {
        type: 'object',
        properties: {
          topic: { type: 'string', description: 'Research topic' },
          existingData: {
            type: 'string',
            description: 'Summary of existing findings or context',
          },
        },
        required: ['topic'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'analyze_findings',
      description:
        'Analyze experiment results and findings for a project. The projectId can be a numeric ID or a project name (will be fuzzy-matched). Fetches experiment logs from the database.',
      parameters: {
        type: 'object',
        properties: {
          projectId: { type: 'string', description: 'ID or name of the project' },
          question: {
            type: 'string',
            description: 'Specific question to answer from the findings',
          },
        },
        required: ['projectId'],
      },
    },
  },
];

export const INVENTORY_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'check_stock',
      description:
        'Check inventory stock levels. Can filter by item name, category, or low stock status.',
      parameters: {
        type: 'object',
        properties: {
          itemName: {
            type: 'string',
            description: 'Filter by item name (partial match)',
          },
          category: { type: 'string', description: 'Filter by category' },
          lowStockOnly: {
            type: 'boolean',
            description: 'Only return items below minimum required',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_stock',
      description:
        'Update the stock quantity of an inventory item. Automatically logs a transaction.',
      parameters: {
        type: 'object',
        properties: {
          itemId: { type: 'number', description: 'ID of the inventory item' },
          newQuantity: { type: 'number', description: 'New stock quantity' },
          reason: { type: 'string', description: 'Reason for stock change' },
        },
        required: ['itemId', 'newQuantity'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'alert_low_stock',
      description:
        'Get a list of all inventory items that are below their minimum required level.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'suggest_reorder',
      description:
        'Analyze inventory usage patterns and suggest reorder quantities for items that need restocking.',
      parameters: {
        type: 'object',
        properties: {
          itemId: {
            type: 'number',
            description: 'Optional: specific item to analyze',
          },
        },
      },
    },
  },
];

export const DATABASE_TOOLS = [
  {
    type: 'function',
    function: {
name: 'query_records',
          description: 'Query records from a database table with optional filters. For text fields like "name", "title", or "description", partial case-insensitive matching is used. For other fields, exact matching is used.',
      parameters: {
        type: 'object',
        properties: {
          table: {
            type: 'string',
            enum: [
              'projects',
              'inventory',
              'experiments_log',
              'ai_actions_log',
              'research_cache',
              'inventory_transactions',
              'agent_tasks',
            ],
          },
          filters: {
            type: 'object',
            description: 'Key-value filters to apply',
          },
          limit: {
            type: 'number',
            description: 'Max records to return (1-50)',
            default: 20,
          },
        },
        required: ['table'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_record',
      description:
        'Create a new record in a database table. The "data" field MUST be a JSON object containing all the record fields. IMPORTANT: Always nest fields inside the "data" object, NOT at the top level.\n- projects: requires "name" (string). Optional: description, status, priority (number).\n- inventory: requires "name" (string). Optional: quantity (number, default 0), unit (string, default "units"), category (string, default "other"), minRequired (number, default 5).\n- experiments_log: requires "projectId" (number or string). Optional: result, success (boolean), notes, hypothesis, methodology, status.\n- agent_tasks: requires "task" (string). Optional: status.',
      parameters: {
        type: 'object',
        properties: {
          table: {
            type: 'string',
            enum: ['projects', 'inventory', 'experiments_log', 'agent_tasks'],
          },
          data: {
            type: 'object',
            description:
              'Record fields as a JSON object. All fields must be inside this object. Example for projects: {"name": "My Project", "status": "planned", "priority": 2}',
          },
        },
        required: ['table', 'data'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_record',
      description: 'Update an existing record in a database table.',
      parameters: {
        type: 'object',
        properties: {
          table: {
            type: 'string',
            enum: ['projects', 'inventory', 'experiments_log', 'agent_tasks'],
          },
          id: { type: 'number', description: 'ID of the record to update' },
          data: { type: 'object', description: 'Fields to update' },
        },
        required: ['table', 'id', 'data'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_record',
      description: 'Delete a record from a database table.',
      parameters: {
        type: 'object',
        properties: {
          table: {
            type: 'string',
            enum: ['projects', 'inventory', 'experiments_log', 'agent_tasks'],
          },
          id: { type: 'number', description: 'ID of the record to delete' },
        },
        required: ['table', 'id'],
      },
    },
  },
];

export const PLANNER_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'route_to_agent',
      description:
        'Route the user query to a specialist agent. Use this to delegate tasks to the appropriate agent.',
      parameters: {
        type: 'object',
        properties: {
          agent: {
            type: 'string',
            enum: ['research', 'inventory', 'database'],
            description: 'Which agent to route to',
          },
          task: {
            type: 'string',
            description: 'Clear description of what the agent should do',
          },
        },
        required: ['agent', 'task'],
      },
    },
  },
];

export const ALL_TOOLS = [
  ...RESEARCH_TOOLS,
  ...INVENTORY_TOOLS,
  ...DATABASE_TOOLS,
];
