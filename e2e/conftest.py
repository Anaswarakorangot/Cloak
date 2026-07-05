import pytest

@pytest.fixture(scope="session")
def browser_type_launch_args(browser_type_launch_args):
    """
    Force Playwright to launch the local Google Chrome installation instead of its bundled Chromium.
    This fulfills Requirement 3: Support offline execution using the pre-installed system Chrome.
    """
    return {
        **browser_type_launch_args,
        "channel": "chrome",
    }

