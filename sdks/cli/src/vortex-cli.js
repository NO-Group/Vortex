import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { VortexClient } from './vortex-client.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Vortex BaaS CLI.
 *
 * Commands:
 *   vortex init <baseUrl>             Initialize a config file
 *   vortex auth signup <email> <pw>  Sign up a new user
 *   vortex auth login <email> <pw>   Log in and save a token
 *   vortex auth me                    Show current user
 *   vortex db tables                  List database tables
 *   vortex db query <table> <json>    Run a query
 *   vortex storage buckets           List storage buckets
 *   vortex functions list             List deployed functions
 *   vortex functions invoke <name>   Invoke a function
 *   vortex apps list                  List apps
 *   vortex billing plans              List billing plans
 *   vortex billing status             Show billing status
 *   vortex admin sql <statement>      Run raw SQL (admin)
 */
export class VortexCLI {
  constructor() {
    this.configPath = path.join(__dirname, '..', 'vortex-cli.config.json');
  }

  async run(args) {
    if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
      this.printHelp();
      return;
    }

    const [command, ...rest] = args;

    try {
      switch (command) {
        case 'init':
          return this.cmdInit(rest);
        case 'auth':
          return this.cmdAuth(rest);
        case 'db':
          return this.cmdDb(rest);
        case 'storage':
          return this.cmdStorage(rest);
        case 'functions':
          return this.cmdFunctions(rest);
        case 'apps':
          return this.cmdApps(rest);
        case 'billing':
          return this.cmdBilling(rest);
        case 'admin':
          return this.cmdAdmin(rest);
        default:
          console.error(`Unknown command: ${command}`);
          this.printHelp();
          process.exitCode = 1;
      }
    } catch (err) {
      console.error(`Error: ${err.message}`);
      process.exitCode = 1;
    }
  }

  printHelp() {
    console.log(`
Vortex BaaS CLI

Usage: vortex <command> [args]

Commands:
  init <baseUrl>              Initialize a config file with the Vortex URL
  auth signup <email> <pw>   Sign up a new user
  auth login <email> <pw>    Log in and save a token
  auth me                    Show the current user
  db tables                  List database tables
  db query <table> <json>    Run a database query
  storage buckets            List storage buckets
  functions list             List deployed functions
  functions invoke <name> <json>  Invoke a function
  apps list                  List apps
  billing plans              List billing plans
  billing status             Show billing status
  admin sql <statement>      Run raw SQL (admin only)
  --help, -h                 Show this help
`);
  }

  loadClient() {
    const cfg = this.readConfig();
    const client = new VortexClient(cfg.baseUrl);
    if (cfg.token) client.setToken(cfg.token);
    return client;
  }

  readConfig() {
    try {
      return JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
    } catch {
      throw new Error('No config found. Run `vortex init <baseUrl>` first.');
    }
  }

  async cmdInit(args) {
    if (args.length < 1) throw new Error('Usage: vortex init <baseUrl>');
    fs.mkdirSync(path.dirname(this.configPath), { recursive: true });
    fs.writeFileSync(this.configPath, JSON.stringify({ baseUrl: args[0], token: '' }, null, 2));
    console.log(`Config written to ${this.configPath}`);
  }

  async cmdAuth(args) {
    const [sub, ...rest] = args;
    const client = this.loadClient();

    switch (sub) {
      case 'signup': {
        requireArg(rest, 'email', 'password');
        const session = await client.auth().signup(rest[0], rest[1]);
        this.saveToken(session.token);
        console.log(JSON.stringify(session.user, null, 2));
        break;
      }
      case 'login': {
        requireArg(rest, 'email', 'password');
        const session = await client.auth().login(rest[0], rest[1]);
        this.saveToken(session.token);
        console.log(JSON.stringify(session.user, null, 2));
        break;
      }
      case 'me': {
        const user = await client.auth().me();
        console.log(JSON.stringify(user, null, 2));
        break;
      }
      default:
        console.error('Usage: vortex auth <signup|login|me> [args]');
        process.exitCode = 1;
    }
  }

  async cmdDb(args) {
    const [sub, ...rest] = args;
    const client = this.loadClient();

    switch (sub) {
      case 'tables': {
        const tables = await client.database().listTables();
        console.log(JSON.stringify(tables, null, 2));
        break;
      }
      case 'query': {
        requireArg(rest, 'table', 'json');
        const result = await client.database().from(rest[0]).execute(JSON.parse(rest[1]));
        console.log(JSON.stringify(result, null, 2));
        break;
      }
      default:
        console.error('Usage: vortex db <tables|query> [args]');
        process.exitCode = 1;
    }
  }

  async cmdStorage(args) {
    const [sub] = args;
    const client = this.loadClient();

    if (sub === 'buckets') {
      const buckets = await client.storage().listBuckets();
      console.log(JSON.stringify(buckets, null, 2));
    } else {
      console.error('Usage: vortex storage <buckets>');
      process.exitCode = 1;
    }
  }

  async cmdFunctions(args) {
    const [sub, ...rest] = args;
    const client = this.loadClient();

    switch (sub) {
      case 'list': {
        const fns = await client.functions().list();
        console.log(JSON.stringify(fns, null, 2));
        break;
      }
      case 'invoke': {
        requireArg(rest, 'name', 'json');
        const result = await client.functions().invoke(rest[0], JSON.parse(rest[1]));
        console.log(JSON.stringify(result, null, 2));
        break;
      }
      default:
        console.error('Usage: vortex functions <list|invoke> [args]');
        process.exitCode = 1;
    }
  }

  async cmdApps(args) {
    const [sub] = args;
    const client = this.loadClient();

    if (sub === 'list') {
      const apps = await client.apps().list();
      console.log(JSON.stringify(apps, null, 2));
    } else {
      console.error('Usage: vortex apps <list>');
      process.exitCode = 1;
    }
  }

  async cmdBilling(args) {
    const [sub] = args;
    const client = this.loadClient();

    switch (sub) {
      case 'plans': {
        const plans = await client.billing().listPlans();
        console.log(JSON.stringify(plans, null, 2));
        break;
      }
      case 'status': {
        const status = await client.billing().status();
        console.log(JSON.stringify(status, null, 2));
        break;
      }
      default:
        console.error('Usage: vortex billing <plans|status>');
        process.exitCode = 1;
    }
  }

  async cmdAdmin(args) {
    const [sub, ...rest] = args;
    const client = this.loadClient();

    if (sub === 'sql') {
      requireArg(rest, 'statement');
      const result = await client.admin().sql(rest.join(' '));
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.error('Usage: vortex admin <sql> <statement>');
      process.exitCode = 1;
    }
  }

  saveToken(token) {
    try {
      const cfg = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
      cfg.token = token;
      fs.writeFileSync(this.configPath, JSON.stringify(cfg, null, 2));
    } catch {
      // Config may not exist yet
    }
  }
}

function requireArg(args, ...names) {
  if (args.length < names.length) {
    throw new Error(`Missing arguments: ${names.join(', ')}`);
  }
}
