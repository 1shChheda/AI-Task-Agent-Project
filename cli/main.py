import os
import sys
import click
from dotenv import load_dotenv

from cli.task_input import get_task_description
from ai_integration.ai_client import generate_plan

load_dotenv()

@click.group()
def cli():
    pass

@cli.command()
@click.option('--task', '-t', help='Task description to execute.')
@click.option('--debug/--no-debug', default=False, help='Enable debug mode for verbose output.')
def run(task, debug):
    #execute a task on your local machine with AI assistance
    if debug:
        os.environ['DEBUG_MODE'] = 'True'
        click.echo("Debug mode enabled. Verbose output will be shown.")
    
    #getting task description if not provided via CLI option
    task_description = task or get_task_description()
    
    if not task_description:
        click.echo("No task provided. Exiting.")
        return
    
    click.echo(f"\nProcessing task: {task_description}\n")
    
    #generate execution plan using AI
    plan = generate_plan(task_description)
    
    if not plan:
        click.echo("WARNING: Failed to generate a plan. Please try again with a clearer task description.")
        return
    
    click.echo("\n📋 Generated Plan:")
    for idx, step in enumerate(plan, 1):
        click.echo(f"  {idx}. {step}")

if __name__ == '__main__':
    cli()