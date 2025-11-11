import re
HEX_66 = re.compile(r"^0x[a-fA-F0-9]{64}$")

def is_hex_66(value: str) -> bool:
    return isinstance(value, str) and bool(HEX_66.fullmatch(value))
