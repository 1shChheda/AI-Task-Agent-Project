import click

def get_task_description():
    click.echo("\nWelcome to AI Task Agent")
    click.echo("================")
    click.echo("Describe a task you'd like the AI to help you with.")
    task = click.prompt("\nEnter your task", type=str)
    
    if not task or len(task.strip()) < 5:
        click.echo("❌ Task description is too short. Please provide more details.")
        return None
    
    return task