-- Migração inicial - Schema básico do jogo de dominó
-- Baseado nos tipos existentes no projeto

-- Extension para UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabela de perfis de usuário (estende auth.users)
CREATE TABLE profiles (
    id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    username text UNIQUE NOT NULL,
    full_name text,
    avatar_url text,
    balance numeric DEFAULT 10.0,
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);

-- RLS para profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Tabela de jogos
CREATE TABLE games (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    status text DEFAULT 'waiting',
    board_state jsonb DEFAULT '{}',
    current_player_turn uuid,
    turn_start_time timestamptz,
    winner_id uuid,
    entry_fee numeric DEFAULT 1.10,
    prize_pool numeric DEFAULT 4.00,
    consecutive_passes integer DEFAULT 0,
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);

-- RLS para games
ALTER TABLE games ENABLE ROW LEVEL SECURITY;

-- Tabela de jogadores em partidas
CREATE TABLE game_players (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    game_id uuid REFERENCES games(id) ON DELETE CASCADE,
    user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
    position integer NOT NULL,
    hand jsonb DEFAULT '[]',
    score integer DEFAULT 0,
    is_ready boolean DEFAULT false,
    joined_at timestamptz DEFAULT NOW(),
    
    UNIQUE(game_id, user_id),
    UNIQUE(game_id, position)
);

-- RLS para game_players
ALTER TABLE game_players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Players can see their games" ON games FOR SELECT USING (
    id IN (SELECT game_id FROM game_players WHERE user_id = auth.uid())
);
CREATE POLICY "Players can see game players" ON game_players FOR SELECT USING (
    game_id IN (SELECT game_id FROM game_players WHERE user_id = auth.uid())
);

-- Tabela de fila de matchmaking
CREATE TABLE matchmaking_queue (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id uuid REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
    status text DEFAULT 'searching',
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);

-- RLS para matchmaking_queue
ALTER TABLE matchmaking_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can see queue" ON matchmaking_queue FOR SELECT TO authenticated;
CREATE POLICY "Users can manage own queue entry" ON matchmaking_queue FOR ALL USING (auth.uid() = user_id);

-- Tabela de presença de jogadores
CREATE TABLE player_presence (
    user_id uuid REFERENCES profiles(id) ON DELETE CASCADE PRIMARY KEY,
    status text DEFAULT 'online',
    last_seen timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);

-- RLS para player_presence
ALTER TABLE player_presence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can see presence" ON player_presence FOR SELECT TO authenticated;
CREATE POLICY "Users can update own presence" ON player_presence FOR ALL USING (auth.uid() = user_id);

-- Tabela de transações
CREATE TABLE transactions (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
    game_id uuid REFERENCES games(id) ON DELETE SET NULL,
    type text NOT NULL, -- 'entry_fee', 'prize', 'refund', etc.
    amount numeric NOT NULL,
    description text,
    created_at timestamptz DEFAULT NOW()
);

-- RLS para transactions
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can see own transactions" ON transactions FOR SELECT USING (auth.uid() = user_id);

-- Tabela de salas de jogo (legacy, se necessário)
CREATE TABLE game_rooms (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    name text NOT NULL,
    status text DEFAULT 'waiting', -- waiting, playing, finished
    max_players integer DEFAULT 4,
    current_players integer DEFAULT 0,
    entry_fee numeric DEFAULT 1.10,
    prize_pool numeric DEFAULT 0,
    board_state jsonb DEFAULT '{}',
    current_turn uuid,
    turn_start_time timestamptz,
    winner_id uuid,
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_games_status ON games(status);
CREATE INDEX idx_game_players_game_id ON game_players(game_id);
CREATE INDEX idx_game_players_user_id ON game_players(user_id);
CREATE INDEX idx_game_players_game_user ON game_players(game_id, user_id);
CREATE INDEX idx_matchmaking_queue_status ON matchmaking_queue(status);
CREATE INDEX idx_matchmaking_queue_created ON matchmaking_queue(created_at);
CREATE INDEX idx_matchmaking_queue_status_created ON matchmaking_queue(status, created_at);
CREATE INDEX idx_player_presence_status ON player_presence(status);
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_game_id ON transactions(game_id);
CREATE INDEX idx_games_current_player ON games(current_player_turn);
CREATE INDEX idx_game_rooms_status ON game_rooms(status);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar triggers de updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_games_updated_at BEFORE UPDATE ON games FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_matchmaking_queue_updated_at BEFORE UPDATE ON matchmaking_queue FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_player_presence_updated_at BEFORE UPDATE ON player_presence FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_game_rooms_updated_at BEFORE UPDATE ON game_rooms FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Trigger para criar perfil automaticamente quando usuário se registra
CREATE OR REPLACE FUNCTION handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO profiles (id, username, full_name, avatar_url)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'username', NEW.email),
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para novos usuários
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE handle_new_user(); 