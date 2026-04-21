"""Fixture for Python language-aware hooks (plan-020)."""

from __future__ import annotations


def add(a: int, b: int) -> int:
    return a + b


class Greeter:
    def __init__(self, name: str) -> None:
        self.name = name

    def hello(self) -> str:
        return f"Hello, {self.name}"
