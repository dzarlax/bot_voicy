FROM node:20

WORKDIR /usr/src/app

# Устанавливаем Python и Pip
RUN apt-get update && apt-get install -y python3 python3-pip python3-venv

# Создаем виртуальное окружение Python и активируем его
RUN python3 -m venv venv
ENV PATH="/usr/src/app/venv/bin:$PATH"

# Устанавливаем transcribe-anything через pip в виртуальное окружение
RUN pip install transcribe-anything

COPY package*.json ./

RUN npm install

COPY . .

CMD ["node", "bot.js"]
