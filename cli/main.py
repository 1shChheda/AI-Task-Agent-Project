import os
import sys
import click
from dotenv import load_dotenv

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
    
    if not task:
        click.echo("No task provided. Exiting.")
        return
    
    click.echo(f"\nProcessing task: {task}\n")

if __name__ == '__main__':
    cli()