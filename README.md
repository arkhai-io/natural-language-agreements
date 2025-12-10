# natural-language-agreements

## Prerequisites

This project depends on the `alkahest` repository, which must be cloned in the same parent directory.

### Setup Instructions

1. **Clone both repositories in the same parent directory:**

```bash
# Navigate to your projects directory
cd ~/Desktop  # or your preferred location

# Clone the alkahest repository
git clone https://github.com/arkhai-io/alkahest.git

# Clone this repository
git clone https://github.com/arkhai-io/natural-language-agreements.git

# Your directory structure should look like:
# parent-directory/
# ├── alkahest/
# │   └── sdks/
# │       └── ts/
# └── natural-language-agreements/
```

2. **Install alkahest dependencies:**

```bash
cd alkahest
bun install
cd ..
```

3. **Install this project's dependencies:**

```bash
cd natural-language-agreements
bun install
```

## Usage

To run:

```bash
bun run index.ts
```

## Development

This project was created using `bun init` in bun v1.2.20. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
