import json

from agents import Agent, WebSearchTool, function_tool
from agents.tool import UserLocation

import app.mock_api as mock_api
from app.config import AGENT_NAME, AGENT_MODEL, AGENT_INSTRUCTIONS, STYLE_INSTRUCTIONS


# @function_tool
# def get_past_orders():
#     return json.dumps(mock_api.get_past_orders())


# @function_tool
# def submit_refund_request(order_number: str):
#     """Confirm with the user first"""
#     return mock_api.submit_refund_request(order_number)


# Create a single agent with all available tools
voice_agent = Agent(
    name=AGENT_NAME,
    instructions=f"{AGENT_INSTRUCTIONS} {STYLE_INSTRUCTIONS}",
    model=AGENT_MODEL,
    tools=[
        # get_past_orders,
        # submit_refund_request,
        # WebSearchTool(user_location=UserLocation(type="approximate", city="Tokyo")),
    ],
)

# Use the voice agent as the starting agent
starting_agent = voice_agent
