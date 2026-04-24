# Test fixture: intentionally insecure Python code for bandit SAST testing.
# DO NOT use in production. This file is only used to verify that the
# post-edit-security hook detects bandit findings at MEDIUM+ severity.

# bandit B102: use of exec() — MEDIUM severity, HIGH confidence (stable 1.7+)
user_input = "print('hello')"
exec(user_input)
