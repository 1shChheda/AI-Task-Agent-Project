#CLI Entry Point

import os
import sys
import platform
import click
from dotenv import load_dotenv

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


from cli.task_input import get_task_description
from ai_integration.ai_client import generate_plan
from executor.command_executor import execute_plan
from feedback.feedback_loop import handle_feedback

load_dotenv()

@click.group()
def cli():
    pass

@cli.command()
@click.option('--task', '-t', help='Task description to execute.')
@click.option('--debug/--no-debug', default=False, help='Enable debug mode for verbose output.')
def run(task, debug):
    #execute a task on your local machine with AI assistance

    current_os = platform.system()
    click.echo(f"Detected operating system: {current_os}")

    if debug:
        os.environ['DEBUG_MODE'] = 'True'
        click.echo("Debug mode enabled. Verbose output will be shown.")
    
    #getting task description if not provided via CLI option
    task_description = task or get_task_description()
    
    if not task_description:
        click.echo("No task provided. Exiting.")
        return
    
    click.echo(f"\n🤖 Processing task: {task_description}\n")
    
    #generate execution plan using AI
    plan = generate_plan(task_description)
    
    if not plan:
        click.echo("WARNING: Failed to generate a plan. Please try again with a clearer task description.")
        return
    
    click.echo("\n📋 Generated Plan:")
    for idx, step in enumerate(plan, 1):
        click.echo(f"  {idx}. {step}")
    
    if not click.confirm("\n✅ Do you approve this plan?", default=True):
        click.echo("Operation canceled by user.")
        return
    
    #execute the approved plan
    success, output = execute_plan(plan)
    
    if success:
        click.echo("\n✅ Task completed successfully!")
        click.echo(f"\nOutput:\n{output}")
        
        if click.confirm("\nWas the task successful?", default=True):
            click.echo("Great! Exiting.")
            return
    else:
        click.echo("\n❌ Task execution failed!")
        click.echo(f"\nError:\n{output}")
    
    #NOTE: if we get here, either execution failed or user wasn't satisfied
    feedback = handle_feedback(task_description, plan, output)
    
    #recursive approach with retry limit
    max_retries = int(os.getenv('MAX_RETRIES', 3))
    retries = 0
    
    while retries < max_retries:
        retries += 1
        click.echo(f"\n🔄 Refining plan (Attempt {retries}/{max_retries})")
        
        #generate refined plan based on feedback
        refined_plan = generate_plan(task_description, previous_attempt=plan, feedback=feedback)
        
        if not refined_plan:
            click.echo("❌ Failed to generate a refined plan.")
            continue
        
        click.echo("\n📋 Refined Plan:")
        for idx, step in enumerate(refined_plan, 1):
            click.echo(f"  {idx}. {step}")
        
        if not click.confirm("\n✅ Do you approve this refined plan?", default=True):
            if click.confirm("Would you like to try again with different feedback?", default=True):
                feedback = handle_feedback(task_description, plan, output, previous_feedback=feedback)
                continue
            else:
                click.echo("Operation canceled by user.")
                return
        
        #execute the approved refined plan
        success, output = execute_plan(refined_plan)
        
        if success:
            click.echo("\n✅ Task completed successfully!")
            click.echo(f"\nOutput:\n{output}")
            
            if click.confirm("\nWas the task successful?", default=True):
                click.echo("Great! Exiting.")
                return
        else:
            click.echo("\n❌ Task execution failed!")
            click.echo(f"\nError:\n{output}")
        
        #get new feedback for the next iteration
        feedback = handle_feedback(task_description, refined_plan, output, previous_feedback=feedback)
    
    click.echo(f"\n❌ Maximum retry limit ({max_retries}) reached. Please try with a different approach.")

if __name__ == '__main__':
    cli()