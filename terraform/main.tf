terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
    local = {
      source  = "hashicorp/local"
      version = "~> 2.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

resource "tls_private_key" "clawdbot" {
  algorithm = "RSA"
  rsa_bits  = 4096
}

resource "aws_key_pair" "clawdbot" {
  key_name   = "clawdbot"
  public_key = tls_private_key.clawdbot.public_key_openssh
}

resource "local_file" "private_key" {
  content         = tls_private_key.clawdbot.private_key_pem
  filename        = "${path.module}/clawdbot.pem"
  file_permission = "0400"
}

data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }
}

resource "aws_security_group" "clawdbot" {
  name        = "clawdbot"
  description = "Security group for clawdbot"

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "clawdbot"
  }
}

resource "aws_instance" "clawdbot" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = var.instance_type
  key_name               = aws_key_pair.clawdbot.key_name
  vpc_security_group_ids = [aws_security_group.clawdbot.id]

  tags = {
    Name = "clawdbot"
  }
}
